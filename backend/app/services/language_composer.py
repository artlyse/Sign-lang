from collections import deque
import time
from typing import Deque, Optional

from app.config import (
    LANGUAGE_AUTO_ACCEPT_MARGIN,
    LANGUAGE_AUTO_ACCEPT_SCORE,
    LANGUAGE_UNKNOWN_AUTO_ACCEPT_SCORE,
    LANGUAGE_UNKNOWN_AUTO_ACCEPT_MARGIN,
    LANGUAGE_UNKNOWN_AUTO_ACCEPT_MAX_DISTANCE,
    LANGUAGE_UNKNOWN_AUTO_ACCEPT_MIN_SIMILARITY,
    LANGUAGE_DYNAMIC_MIN_CONFIDENCE,
    LANGUAGE_STATIC_MIN_CONFIDENCE,
    LANGUAGE_STATIC_STABLE_FRAMES,
    LANGUAGE_STATIC_HOLD_MS,
    LANGUAGE_DYNAMIC_HOLD_MS,
    LANGUAGE_LETTER_COOLDOWN_MS,
    IMPLICIT_LEARNING_ENABLED,
    IMPLICIT_LEARNING_WEIGHT,
    IMPLICIT_LEARNING_MIN_SCORE,
    IMPLICIT_LEARNING_MIN_MARGIN,
)
from app.services.language_service import language_service


class LanguageComposerSession:
    """Estado de escritura y feedback para una conexion WebSocket."""

    def __init__(self):
        self.raw_word = ""
        self.sentence_words = []
        self.suggestions = []

        self.candidate_letter: Optional[str] = None
        self.candidate_mode: Optional[str] = None
        self.candidate_confidences: Deque[float] = deque(
            maxlen=LANGUAGE_STATIC_STABLE_FRAMES
        )
        self.candidate_frames = 0
        self.candidate_started_at = 0.0
        self.last_accepted_at = 0.0

        self.last_accepted_letter: Optional[str] = None
        self.same_letter_locked = False
        self.last_event = None

        # Una palabra autocorregida NO entrena al sistema hasta que el usuario
        # confirme que fue correcta o escriba la correccion real.
        self.pending_feedback: Optional[dict] = None

    def _context_words(self):
        return list(self.sentence_words[-2:])

    def _previous_word(self) -> Optional[str]:
        return self.sentence_words[-1] if self.sentence_words else None


    def _commit_pending_implicit(self):
        """
        El usuario comenzó otra palabra sin corregir la anterior. Eso se toma
        como feedback débil, nunca como verdad absoluta y no entrena el SGD.
        """
        if not self.pending_feedback or not IMPLICIT_LEARNING_ENABLED:
            return None

        feedback = dict(self.pending_feedback)
        score = float(feedback.get("score", 0.0))
        margin = float(feedback.get("margin", 0.0))

        if score < IMPLICIT_LEARNING_MIN_SCORE or margin < IMPLICIT_LEARNING_MIN_MARGIN:
            self.pending_feedback = None
            return None

        result = language_service.learn_from_feedback(
            raw=feedback["raw"],
            correct=feedback["predicted"],
            context_words=feedback.get("context_words", []),
            predicted=feedback["predicted"],
            source="implicit_continue",
            weight=IMPLICIT_LEARNING_WEIGHT,
            train_ranker=False,
        )
        self.pending_feedback = None
        return result

    def _refresh_suggestions(self):
        if len(self.raw_word) < 2:
            self.suggestions = []
            return

        self.suggestions = language_service.suggest(
            self.raw_word,
            context_words=self._context_words(),
        )

    def _reset_current_word_state(self):
        self.raw_word = ""
        self.suggestions = []
        self.candidate_letter = None
        self.candidate_mode = None
        self.candidate_frames = 0
        self.candidate_started_at = 0.0
        self.candidate_confidences.clear()
        self.last_accepted_letter = None
        self.same_letter_locked = False

    def _accept_letter(self, letter: str, confidence: float, mode: str):
        implicit_learning = None
        if not self.raw_word and self.pending_feedback:
            implicit_learning = self._commit_pending_implicit()

        self.raw_word += letter
        self.last_accepted_at = time.monotonic()
        self.last_accepted_letter = letter
        self.same_letter_locked = True
        self.last_event = {
            "type": "letter_added",
            "letter": letter,
            "confidence": round(float(confidence), 4),
            "mode": mode,
            "implicit_learning": implicit_learning,
        }
        self._refresh_suggestions()

    def process_prediction(self, recognition_result: dict) -> dict:
        """
        Agrega una letra solo cuando la prediccion permanece estable durante
        un tiempo minimo real. Esto evita aceptar posturas intermedias mientras
        el usuario mueve la mano de una seña a otra.
        """
        self.last_event = None

        letter = str(recognition_result.get("letter", "-")).upper()
        confidence = float(recognition_result.get("confidence", 0.0))
        mode = str(recognition_result.get("mode", "static"))
        now = time.monotonic()

        if letter == "-" or not letter:
            self.candidate_letter = None
            self.candidate_mode = None
            self.candidate_frames = 0
            self.candidate_started_at = 0.0
            self.candidate_confidences.clear()
            return self.state()

        min_confidence = (
            LANGUAGE_DYNAMIC_MIN_CONFIDENCE
            if mode == "dynamic"
            else LANGUAGE_STATIC_MIN_CONFIDENCE
        )

        if confidence < min_confidence:
            self.candidate_letter = None
            self.candidate_mode = None
            self.candidate_frames = 0
            self.candidate_started_at = 0.0
            self.candidate_confidences.clear()
            return self.state()

        # Una letra distinta inicia un periodo nuevo de estabilizacion.
        if letter != self.candidate_letter or mode != self.candidate_mode:
            self.candidate_letter = letter
            self.candidate_mode = mode
            self.candidate_frames = 1
            self.candidate_started_at = now
            self.candidate_confidences.clear()
            self.candidate_confidences.append(confidence)

            if letter != self.last_accepted_letter:
                self.same_letter_locked = False

            return self.state()

        self.candidate_frames += 1
        self.candidate_confidences.append(confidence)

        stable_frames_required = (
            1 if mode == "dynamic" else LANGUAGE_STATIC_STABLE_FRAMES
        )
        hold_ms_required = (
            LANGUAGE_DYNAMIC_HOLD_MS
            if mode == "dynamic"
            else LANGUAGE_STATIC_HOLD_MS
        )

        held_ms = (now - self.candidate_started_at) * 1000.0
        avg_confidence = sum(self.candidate_confidences) / max(
            len(self.candidate_confidences), 1
        )

        frames_ok = self.candidate_frames >= stable_frames_required
        time_ok = held_ms >= hold_ms_required

        # Despues de aceptar una letra, esperamos un instante antes de aceptar
        # una nueva. La prediccion visual puede cambiar durante ese periodo,
        # pero no se agrega a la secuencia.
        cooldown_ok = (
            self.last_accepted_at <= 0.0
            or (now - self.last_accepted_at) * 1000.0
            >= LANGUAGE_LETTER_COOLDOWN_MS
        )

        if frames_ok and time_ok and cooldown_ok:
            if not (
                self.same_letter_locked
                and self.last_accepted_letter == letter
            ):
                self._accept_letter(letter, avg_confidence, mode)

        return self.state()

    def hand_absent(self) -> dict:
        self.candidate_letter = None
        self.candidate_mode = None
        self.candidate_frames = 0
        self.candidate_started_at = 0.0
        self.candidate_confidences.clear()
        self.same_letter_locked = False
        self.last_event = {"type": "hand_absent"}
        return self.state()

    def _resolve_word(self, raw: str, suggestions=None) -> dict:
        """
        Decide UNA sola vez cual palabra representa a la secuencia actual.

        raw se conserva para aprendizaje, pero la UI y finalize_word usan el
        mismo `word` resuelto. Asi evitamos el efecto HOLA -> HBXA al cerrar.
        """
        raw = (raw or "").strip().upper()
        if not raw:
            return {
                "word": "",
                "raw": "",
                "autocorrected": False,
                "score": 0.0,
                "margin": 0.0,
                "reason": "empty",
            }

        if suggestions is None:
            suggestions = language_service.suggest(
                raw,
                context_words=self._context_words(),
            )

        if not suggestions:
            return {
                "word": raw,
                "raw": raw,
                "autocorrected": False,
                "score": 0.0,
                "margin": 0.0,
                "reason": "no_suggestions",
            }

        best = suggestions[0]
        second_score = (
            float(suggestions[1]["score"])
            if len(suggestions) > 1
            else 0.0
        )
        best_score = float(best.get("score", 0.0))
        margin = best_score - second_score
        best_word = str(best.get("word", raw)).upper()

        raw_key = language_service.normalize_key(raw)
        best_key = language_service.normalize_key(best_word)
        exact = best_key == raw_key

        raw_is_dictionary_word = language_service.is_dictionary_word(raw)
        best_is_dictionary_word = bool(best.get("dictionary", False))
        best_is_completion = bool(best.get("completion", False))
        best_distance = float(best.get("distance", 99.0))
        best_similarity = float(best.get("similarity", 0.0))

        # Una completacion de prefijo (HOL -> HOLA) solo se muestra como
        # sugerencia. No se aplica sola mientras el usuario aun podria seguir.
        normal_accept = (
            not best_is_completion
            and best_score >= LANGUAGE_AUTO_ACCEPT_SCORE
            and margin >= LANGUAGE_AUTO_ACCEPT_MARGIN
        )

        # Si la captura NO es palabra valida (HBXA) y Hunspell propone una
        # palabra real suficientemente cercana (HOLA), usamos esa palabra.
        # No exigimos margen contra el segundo candidato porque eso era lo que
        # provocaba que HOLA apareciera y luego volviera a HBXA.
        unknown_raw_accept = (
            not raw_is_dictionary_word
            and best_is_dictionary_word
            and not best_is_completion
            and best_score >= LANGUAGE_UNKNOWN_AUTO_ACCEPT_SCORE
            and best_distance <= LANGUAGE_UNKNOWN_AUTO_ACCEPT_MAX_DISTANCE
            and best_similarity >= LANGUAGE_UNKNOWN_AUTO_ACCEPT_MIN_SIMILARITY
        )

        if exact:
            chosen = best_word
            reason = "exact"
        elif unknown_raw_accept:
            chosen = best_word
            reason = "unknown_dictionary_correction"
        elif normal_accept:
            chosen = best_word
            reason = "high_confidence_correction"
        else:
            chosen = raw
            reason = "keep_raw"

        return {
            "word": chosen,
            "raw": raw,
            "autocorrected": (
                language_service.normalize_key(chosen) != raw_key
            ),
            "score": best_score if chosen != raw or exact else 0.0,
            "margin": margin,
            "reason": reason,
            "top_suggestion": best_word,
            "raw_is_dictionary_word": raw_is_dictionary_word,
        }

    def finalize_word(self) -> dict:
        self.last_event = None
        raw = self.raw_word.strip().upper()

        if not raw:
            return self.state()

        context_before = self._context_words()
        suggestions = language_service.suggest(
            raw,
            context_words=context_before,
        )
        resolution = self._resolve_word(raw, suggestions)

        chosen = resolution["word"]
        autocorrected = bool(resolution["autocorrected"])
        chosen_score = float(resolution["score"])
        margin = float(resolution["margin"])

        self.sentence_words.append(chosen)

        self.pending_feedback = {
            "raw": raw,
            "predicted": chosen,
            "context_words": context_before,
            "autocorrected": autocorrected,
            "score": round(chosen_score, 4),
            "margin": round(margin, 4),
            "suggestions": [item["word"] for item in suggestions[:5]],
            "raw_is_dictionary_word": bool(
                resolution.get("raw_is_dictionary_word", False)
            ),
        }

        self.last_event = {
            "type": "word_finalized",
            "raw": raw,
            "word": chosen,
            "autocorrected": autocorrected,
            "score": round(chosen_score, 4),
            "needs_feedback": True,
            "top_suggestion": suggestions[0]["word"] if suggestions else None,
            "top_score": (
                round(float(suggestions[0]["score"]), 4)
                if suggestions
                else 0.0
            ),
            "margin": round(margin, 4),
            "resolution_reason": resolution.get("reason"),
        }

        self._reset_current_word_state()
        return self.state()

    def choose_suggestion(self, word: str) -> dict:
        requested_key = language_service.normalize_key(word)
        allowed = {
            language_service.normalize_key(item["word"]): item["word"]
            for item in self.suggestions
        }

        chosen = allowed.get(requested_key)
        if not chosen:
            return self.state(
                error="La sugerencia seleccionada ya no esta disponible"
            )

        raw = self.raw_word
        context_before = self._context_words()
        predicted = self.suggestions[0]["word"] if self.suggestions else raw

        learning_result = language_service.learn_from_feedback(
            raw=raw,
            correct=chosen,
            context_words=context_before,
            predicted=predicted,
            source="suggestion_click",
        )

        self.sentence_words.append(chosen)
        self.pending_feedback = None
        self.last_event = {
            "type": "word_selected",
            "raw": raw,
            "word": chosen,
            "learning": learning_result,
        }

        self._reset_current_word_state()
        return self.state()

    def confirm_learning(self) -> dict:
        if not self.pending_feedback:
            return self.state(error="No hay una palabra pendiente de confirmar")

        feedback = dict(self.pending_feedback)
        learning_result = language_service.learn_from_feedback(
            raw=feedback["raw"],
            correct=feedback["predicted"],
            context_words=feedback.get("context_words", []),
            predicted=feedback["predicted"],
            source="confirmed_word",
        )

        self.pending_feedback = None
        self.last_event = {
            "type": "learning_confirmed",
            "raw": feedback["raw"],
            "word": feedback["predicted"],
            "learning": learning_result,
        }
        return self.state()

    def correct_last_word(self, word: str) -> dict:
        if not self.pending_feedback:
            return self.state(error="No hay una palabra pendiente de corregir")

        corrected = (word or "").strip().upper()
        corrected_key = language_service.normalize_key(corrected)
        if not corrected_key:
            return self.state(error="Escribe una correccion valida")

        feedback = dict(self.pending_feedback)

        if self.sentence_words:
            self.sentence_words[-1] = corrected

        learning_result = language_service.learn_from_feedback(
            raw=feedback["raw"],
            correct=corrected,
            context_words=feedback.get("context_words", []),
            predicted=feedback["predicted"],
            source="manual_correction",
        )

        self.pending_feedback = None
        self.last_event = {
            "type": "learning_corrected",
            "raw": feedback["raw"],
            "predicted": feedback["predicted"],
            "word": corrected,
            "learning": learning_result,
        }
        return self.state()

    def dismiss_learning(self) -> dict:
        if self.pending_feedback:
            ignored = dict(self.pending_feedback)
            self.pending_feedback = None
            self.last_event = {
                "type": "learning_dismissed",
                "raw": ignored.get("raw"),
                "word": ignored.get("predicted"),
            }
        return self.state()

    def backspace(self) -> dict:
        self.last_event = None

        if self.raw_word:
            removed = self.raw_word[-1]
            self.raw_word = self.raw_word[:-1]
            self.same_letter_locked = False
            self.last_accepted_letter = None
            self._refresh_suggestions()
            self.last_event = {
                "type": "letter_removed",
                "letter": removed,
            }
        elif self.sentence_words:
            removed = self.sentence_words.pop()
            if self.pending_feedback:
                self.pending_feedback = None
            self.last_event = {
                "type": "word_removed",
                "word": removed,
            }

        return self.state()

    def clear(self) -> dict:
        self.raw_word = ""
        self.sentence_words = []
        self.suggestions = []
        self.candidate_letter = None
        self.candidate_mode = None
        self.candidate_frames = 0
        self.candidate_confidences.clear()
        self.last_accepted_letter = None
        self.same_letter_locked = False
        self.pending_feedback = None
        self.last_event = {"type": "cleared"}
        return self.state()

    def state(self, error: Optional[str] = None) -> dict:
        # raw_word es la captura original y nunca se destruye mientras se esta
        # formando la palabra. resolved_word es lo que ve el usuario.
        resolution = self._resolve_word(self.raw_word, self.suggestions)
        resolved = resolution["word"] if self.raw_word else ""
        preview = resolved
        sentence = " ".join(self.sentence_words)

        if sentence and resolved:
            display_text = f"{sentence} {resolved}"
        else:
            display_text = sentence or resolved

        result = {
            "raw_word": self.raw_word,
            "resolved_word": resolved,
            "preview_word": preview,
            "autocorrect_active": bool(resolution.get("autocorrected", False)),
            "resolution_reason": resolution.get("reason"),
            "suggestions": self.suggestions,
            "sentence_words": list(self.sentence_words),
            "sentence": sentence,
            "display_text": display_text,
            "event": self.last_event,
            "learning": {
                "pending_feedback": self.pending_feedback,
                "stats": language_service.learning_stats(),
            },
        }

        if error:
            result["error"] = error

        return result
