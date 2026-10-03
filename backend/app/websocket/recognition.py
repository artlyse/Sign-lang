import asyncio
from datetime import datetime, timezone
from typing import Optional, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import WS_REQUIRE_AUTH
from app.core.security import decode_access_token
from app.database import SessionLocal
from app.models.prediction import Prediction
from app.models.session import Session as RecognitionSessionModel
from app.models.user import User
from app.services.hybrid_recognition_service import HybridRecognitionSession
from app.services.language_composer import LanguageComposerSession
from app.services.learning_context import reset_learning_user, set_learning_user
from app.services.recognition_service import recognition_service
from app.services.sentence_corrector_service import sentence_corrector_service

router = APIRouter()


def _authenticate_ws(token: Optional[str]) -> Optional[User]:
    if not token:
        return None

    payload = decode_access_token(token)
    if not payload:
        return None

    try:
        user_id = int(payload["sub"])
    except Exception:
        return None

    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if not user or not user.is_active:
            return None
        db.expunge(user)
        return user
    except Exception as exc:
        # Un token viejo o una BD anterior NO debe romper el reconocimiento
        # cuando WS_REQUIRE_AUTH=false.
        print(f"ADVERTENCIA autenticando WebSocket: {exc}")
        return None
    finally:
        db.close()


def _create_recognition_session(user_id: Optional[int]) -> Optional[int]:
    if user_id is None:
        return None

    db = SessionLocal()
    try:
        row = RecognitionSessionModel(
            user_id=user_id,
            mode="hybrid",
            total_predictions=0,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row.id
    except Exception as exc:
        db.rollback()
        print(f"ADVERTENCIA creando sesión SQL: {exc}")
        return None
    finally:
        db.close()


def _close_recognition_session(
    session_id: Optional[int],
    total_predictions: int,
) -> None:
    if session_id is None:
        return

    db = SessionLocal()
    try:
        row = db.get(RecognitionSessionModel, session_id)
        if row:
            row.ended_at = datetime.now(timezone.utc)
            row.total_predictions = int(total_predictions)
            db.commit()
    except Exception as exc:
        db.rollback()
        print(f"ADVERTENCIA cerrando sesión SQL: {exc}")
    finally:
        db.close()


def _persist_prediction(
    session_id: Optional[int],
    text: str,
    confidence: float,
    mode: str,
) -> None:
    if session_id is None or not text:
        return

    db = SessionLocal()
    try:
        db.add(
            Prediction(
                session_id=session_id,
                text=str(text)[:255],
                translation=None,
                confidence=float(confidence),
                mode=str(mode)[:20],
            )
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        # Persistencia nunca debe tumbar la cámara.
        print(f"ADVERTENCIA guardando predicción SQL: {exc}")
    finally:
        db.close()


async def _safe_send(websocket: WebSocket, payload: dict) -> bool:
    try:
        await websocket.send_json(payload)
        return True
    except Exception:
        return False


@router.websocket("/ws/recognition")
async def websocket_recognition(websocket: WebSocket):
    token_value = websocket.query_params.get("token")

    # Si la autenticación no es obligatoria, un token vencido se ignora y el
    # usuario entra como invitado. Esto evita romper Translator por localStorage.
    user = await asyncio.to_thread(_authenticate_ws, token_value)

    if WS_REQUIRE_AUTH and user is None:
        await websocket.accept()
        await websocket.send_json(
            {
                "mode": "system",
                "error": "Autenticación requerida",
            }
        )
        await websocket.close(code=4401)
        return

    await websocket.accept()
    print(
        "Cliente WebSocket conectado"
        + (f" user_id={user.id}" if user else " invitado")
    )

    user_id = user.id if user else None
    learning_token = set_learning_user(user_id)

    recognition_session_id = await asyncio.to_thread(
        _create_recognition_session,
        user_id,
    )

    hybrid_session = HybridRecognitionSession()
    language_session = LanguageComposerSession()
    prediction_count = 0

    # Tareas SQL en segundo plano. No forman parte del camino crítico de cámara.
    persistence_tasks: Set[asyncio.Task] = set()

    def schedule_persistence(
        text: str,
        confidence: float,
        mode: str,
    ) -> None:
        if recognition_session_id is None:
            return

        task = asyncio.create_task(
            asyncio.to_thread(
                _persist_prediction,
                recognition_session_id,
                text,
                confidence,
                mode,
            )
        )
        persistence_tasks.add(task)
        task.add_done_callback(persistence_tasks.discard)

    try:
        while True:
            try:
                data = await websocket.receive_json()
            except WebSocketDisconnect:
                break
            except Exception as exc:
                print(f"Error recibiendo WebSocket: {exc}")
                break

            mode = str(data.get("mode", "hybrid"))
            request_id = data.get("request_id")

            try:
                if mode == "hybrid":
                    landmarks = data.get("landmarks", [])
                    timestamp_ms = data.get("timestamp_ms")

                    result = await asyncio.to_thread(
                        hybrid_session.process,
                        landmarks,
                        timestamp_ms,
                    )
                    result["kind"] = "recognition"
                    if request_id is not None:
                        result["request_id"] = request_id

                    # La letra se envía INMEDIATAMENTE. El corrector lingüístico
                    # se procesa después y nunca impide que el front vea la seña.
                    if not await _safe_send(websocket, result):
                        break

                    if "error" in result:
                        continue

                    language_state = await asyncio.to_thread(
                        language_session.process_prediction,
                        result,
                    )

                    language_payload = {
                        "kind": "language",
                        "mode": "language",
                        "status": "language_update",
                        "language": language_state,
                    }
                    if request_id is not None:
                        language_payload["request_id"] = request_id

                    if not await _safe_send(websocket, language_payload):
                        break

                    event = language_state.get("event") or {}
                    if event.get("type") == "letter_added":
                        prediction_count += 1
                        schedule_persistence(
                            event.get("letter", ""),
                            float(event.get("confidence", 0.0)),
                            str(event.get("mode", "static")),
                        )

                elif mode == "static":
                    landmarks = data.get("landmarks", [])
                    result = await asyncio.to_thread(
                        recognition_service.predict_static,
                        landmarks,
                    )
                    result["kind"] = "recognition"
                    if request_id is not None:
                        result["request_id"] = request_id

                    if not await _safe_send(websocket, result):
                        break

                    if "error" not in result:
                        language_state = await asyncio.to_thread(
                            language_session.process_prediction,
                            result,
                        )
                        await _safe_send(
                            websocket,
                            {
                                "kind": "language",
                                "mode": "language",
                                "status": "language_update",
                                "language": language_state,
                            },
                        )

                elif mode == "dynamic":
                    sequence = data.get("sequence", [])
                    result = await asyncio.to_thread(
                        recognition_service.predict_dynamic,
                        sequence,
                    )
                    result["kind"] = "recognition"
                    if request_id is not None:
                        result["request_id"] = request_id

                    if not await _safe_send(websocket, result):
                        break

                    if "error" not in result:
                        language_state = await asyncio.to_thread(
                            language_session.process_prediction,
                            result,
                        )
                        await _safe_send(
                            websocket,
                            {
                                "kind": "language",
                                "mode": "language",
                                "status": "language_update",
                                "language": language_state,
                            },
                        )

                elif mode in {"hand_absent", "reset"}:
                    hybrid_session.reset()
                    language_state = language_session.hand_absent()
                    await _safe_send(
                        websocket,
                        {
                            "kind": "language",
                            "mode": "language",
                            "status": "hand_absent",
                            "language": language_state,
                        },
                    )

                elif mode == "finalize_word":
                    language_state = await asyncio.to_thread(
                        language_session.finalize_word
                    )
                    await _safe_send(
                        websocket,
                        {
                            "kind": "language",
                            "mode": "language",
                            "status": "word_finalized",
                            "language": language_state,
                        },
                    )

                elif mode == "choose_suggestion":
                    language_state = await asyncio.to_thread(
                        language_session.choose_suggestion,
                        str(data.get("word", "")),
                    )
                    await _safe_send(
                        websocket,
                        {
                            "kind": "language",
                            "mode": "language",
                            "status": "suggestion_selected",
                            "language": language_state,
                        },
                    )

                elif mode == "replace_sentence_word":
                    language_state = await asyncio.to_thread(
                        language_session.replace_sentence_word,
                        int(data.get("index", -1)),
                        str(data.get("word", "")),
                    )
                    await _safe_send(
                        websocket,
                        {
                            "kind": "language",
                            "mode": "language",
                            "status": "sentence_word_replaced",
                            "language": language_state,
                        },
                    )

                elif mode == "correct_last_word":
                    language_state = await asyncio.to_thread(
                        language_session.correct_last_word,
                        str(data.get("word", "")),
                    )
                    await _safe_send(
                        websocket,
                        {
                            "kind": "language",
                            "mode": "language",
                            "status": "learning_corrected",
                            "language": language_state,
                        },
                    )

                elif mode == "dismiss_learning":
                    language_state = language_session.dismiss_learning()
                    await _safe_send(
                        websocket,
                        {
                            "kind": "language",
                            "mode": "language",
                            "status": "learning_dismissed",
                            "language": language_state,
                        },
                    )

                elif mode == "backspace_language":
                    language_state = language_session.backspace()
                    await _safe_send(
                        websocket,
                        {
                            "kind": "language",
                            "mode": "language",
                            "status": "language_backspace",
                            "language": language_state,
                        },
                    )

                elif mode == "clear_language":
                    language_state = language_session.clear()
                    hybrid_session.reset()
                    await _safe_send(
                        websocket,
                        {
                            "kind": "language",
                            "mode": "language",
                            "status": "language_cleared",
                            "language": language_state,
                        },
                    )

                elif mode == "get_language_state":
                    await _safe_send(
                        websocket,
                        {
                            "kind": "language",
                            "mode": "language",
                            "status": "language_state",
                            "language": language_session.state(),
                        },
                    )

                elif mode == "correct_sentence":
                    # Si queda una palabra abierta, la resolvemos primero.
                    current_state = language_session.state()
                    if current_state.get("raw_word"):
                        current_state = await asyncio.to_thread(
                            language_session.finalize_word
                        )

                    sentence = str(
                        data.get("sentence")
                        or current_state.get("sentence")
                        or current_state.get("display_text")
                        or ""
                    ).strip()

                    correction = await asyncio.to_thread(
                        sentence_corrector_service.correct,
                        sentence,
                    )

                    await _safe_send(
                        websocket,
                        {
                            "kind": "sentence_correction",
                            "mode": "language",
                            "status": "sentence_corrected",
                            "sentence_correction": correction,
                            "language": current_state,
                        },
                    )

                elif mode == "ping":
                    await _safe_send(
                        websocket,
                        {
                            "kind": "system",
                            "mode": "system",
                            "status": "pong",
                        },
                    )

                else:
                    await _safe_send(
                        websocket,
                        {
                            "kind": "system",
                            "error": f"Modo no válido: {mode}",
                        },
                    )

            except Exception as exc:
                # Un error en lenguaje/SQL no debe cerrar el WebSocket entero.
                print(f"Error procesando mensaje WebSocket ({mode}): {exc}")
                payload = {
                    "kind": "system",
                    "error": str(exc),
                }
                if request_id is not None:
                    payload["request_id"] = request_id
                if not await _safe_send(websocket, payload):
                    break

    finally:
        if persistence_tasks:
            await asyncio.gather(
                *list(persistence_tasks),
                return_exceptions=True,
            )

        await asyncio.to_thread(
            _close_recognition_session,
            recognition_session_id,
            prediction_count,
        )
        reset_learning_user(learning_token)
        print("Cliente WebSocket desconectado")
