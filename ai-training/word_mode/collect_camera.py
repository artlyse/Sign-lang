"""Captura dinámica desde cámara para el dataset de palabras.

Cada muestra almacena una ejecución temporal de 30 frames a ~15 FPS. Detecta
cámaras funcionales, usa dos manos + pose y guarda archivos NPZ por etiqueta."""

from __future__ import annotations

import argparse
import os
import time
from dataclasses import dataclass

import cv2

from dataset_utils import save_sample
from download_models import ensure_models
from feature_extractor import WORD_SEQUENCE_FRAMES, WordFeatureExtractor, draw_debug


TARGET_FPS = 15
SAMPLE_INTERVAL = 1.0 / TARGET_FPS

PREVIEW_NAME = "SignLang - Captura palabra dinamica"

# Resolución orientativa. OpenCV/cámara puede negociar otra.
CAMERA_WIDTH = 1280
CAMERA_HEIGHT = 720
CAMERA_FPS = 30


@dataclass
class CameraInfo:
    index: int
    width: int
    height: int
    backend: str


def _backend_name(cap: cv2.VideoCapture) -> str:
    try:
        return cap.getBackendName()
    except Exception:
        return "desconocido"


def _candidate_backends():
    """
    En Windows intentamos DirectShow antes de MSMF porque algunas cámaras
    virtuales/NVIDIA pueden abrir con MSMF pero no entregar frames.
    """
    if os.name == "nt":
        return [
            ("DSHOW", cv2.CAP_DSHOW),
            ("MSMF", cv2.CAP_MSMF),
            ("AUTO", cv2.CAP_ANY),
        ]
    return [("AUTO", cv2.CAP_ANY)]


def _try_open_camera(index: int, warmup_seconds: float = 2.0):
    last_reason = "sin respuesta"

    for requested_name, backend in _candidate_backends():
        cap = cv2.VideoCapture(index, backend)

        if not cap.isOpened():
            cap.release()
            last_reason = f"{requested_name}: no se pudo abrir"
            continue

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAMERA_WIDTH)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAMERA_HEIGHT)
        cap.set(cv2.CAP_PROP_FPS, CAMERA_FPS)

        # Algunas webcams necesitan varios reads antes del primer frame.
        deadline = time.monotonic() + warmup_seconds
        good_frame = None

        while time.monotonic() < deadline:
            ok, frame = cap.read()
            if ok and frame is not None and frame.size > 0:
                good_frame = frame
                break
            time.sleep(0.05)

        if good_frame is not None:
            height, width = good_frame.shape[:2]
            real_backend = _backend_name(cap)

            print(
                f"Camara {index} abierta: "
                f"{width}x{height} | backend={real_backend}"
            )
            return cap, good_frame

        cap.release()
        last_reason = (
            f"{requested_name}: abre el dispositivo, "
            "pero no entrega imagen"
        )

    raise RuntimeError(
        f"No se pudo usar la camara {index}. "
        f"Ultimo resultado: {last_reason}"
    )


def list_cameras(max_index: int = 8) -> list[CameraInfo]:
    """
    Busca cámaras que realmente entreguen al menos un frame.
    No considera disponible un dispositivo que solo pueda abrirse.
    """
    found: list[CameraInfo] = []

    print("\nBuscando camaras disponibles...")

    for index in range(max_index):
        cap = None
        try:
            cap, frame = _try_open_camera(
                index,
                warmup_seconds=0.7,
            )
            height, width = frame.shape[:2]
            found.append(
                CameraInfo(
                    index=index,
                    width=width,
                    height=height,
                    backend=_backend_name(cap),
                )
            )
            print(
                f"  [{index}] disponible "
                f"{width}x{height} | {_backend_name(cap)}"
            )
        except Exception:
            pass
        finally:
            if cap is not None:
                cap.release()

        # Dar tiempo al driver para liberar la webcam.
        time.sleep(0.08)

    if not found:
        print("  No se encontro ninguna camara que entregue frames.")
    return found


def _draw_recording_progress(preview, label: str, saved: int, samples: int,
                             recording: bool, sequence_len: int):
    if recording:
        text = (
            f"GRABANDO {sequence_len}/{WORD_SEQUENCE_FRAMES} "
            f"| {label.upper()} | muestra {saved + 1}/{samples}"
        )
        color = (0, 0, 255)
    else:
        text = (
            f"{label.upper()} | muestras {saved}/{samples} "
            "| ESPACIO = grabar"
        )
        color = (20, 220, 20)

    cv2.rectangle(preview, (0, 0), (preview.shape[1], 60), (20, 20, 20), -1)
    cv2.putText(
        preview,
        text,
        (18, 38),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.65,
        color,
        2,
        cv2.LINE_AA,
    )


def capture(label: str, camera: int = 0, samples: int = 20):
    label = str(label or "").strip().upper()
    if not label:
        raise ValueError("La palabra/etiqueta no puede estar vacia")
    if samples <= 0:
        raise ValueError("La cantidad de muestras debe ser mayor que 0")

    hand_model, pose_model = ensure_models()
    extractor = WordFeatureExtractor(hand_model, pose_model)

    cap = None
    try:
        cap, first_frame = _try_open_camera(camera, warmup_seconds=3.0)

        # Ventana explícita y redimensionable.
        cv2.namedWindow(PREVIEW_NAME, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(PREVIEW_NAME, 960, 540)

        print("\n" + "=" * 60)
        print("CAPTURA DINAMICA DE PALABRAS")
        print("=" * 60)
        print(f"Palabra: {label}")
        print(f"Camara: {camera}")
        print(f"Secuencia: {WORD_SEQUENCE_FRAMES} frames")
        print(f"Muestreo: {TARGET_FPS} FPS")
        print(
            f"Duracion aproximada por muestra: "
            f"{WORD_SEQUENCE_FRAMES / TARGET_FPS:.1f} segundos"
        )
        print()
        print("CONTROLES")
        print("ESPACIO = iniciar grabacion de una muestra")
        print("Q / ESC = salir")
        print()
        print(
            "IMPORTANTE: durante la grabacion debe verse al menos una mano. "
            "Se capturan ambas manos y la pose/brazos cuando estan disponibles."
        )
        print("=" * 60 + "\n")

        saved = 0
        recording = False
        sequence = []
        last_sample = 0.0
        consecutive_read_failures = 0
        frame = first_frame

        while saved < samples:
            if frame is None:
                ok, frame = cap.read()
                if not ok or frame is None or frame.size == 0:
                    consecutive_read_failures += 1
                    frame = None

                    if consecutive_read_failures >= 30:
                        raise RuntimeError(
                            "La camara dejo de entregar imagen durante la captura. "
                            "Prueba otro indice o cierra aplicaciones que usen la webcam."
                        )

                    time.sleep(0.03)
                    continue

            consecutive_read_failures = 0

            timestamp_ms = int(time.monotonic() * 1000)
            bundle = extractor.process(frame, timestamp_ms)
            preview = draw_debug(frame.copy(), bundle)

            if recording:
                now = time.monotonic()

                # SOLO se agrega un frame a la secuencia cuando MediaPipe
                # detecta al menos una mano. Pose puede faltar puntualmente.
                if bundle is not None and now - last_sample >= SAMPLE_INTERVAL:
                    sequence.append(bundle.features)
                    last_sample = now

                _draw_recording_progress(
                    preview,
                    label,
                    saved,
                    samples,
                    True,
                    len(sequence),
                )

                # Si pasan muchos frames y no hay mano, avisar en pantalla.
                if bundle is None:
                    cv2.putText(
                        preview,
                        "No se detecta ninguna mano - acerca las manos a la camara",
                        (18, preview.shape[0] - 25),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.58,
                        (0, 180, 255),
                        2,
                        cv2.LINE_AA,
                    )

                if len(sequence) >= WORD_SEQUENCE_FRAMES:
                    path = save_sample(
                        label,
                        sequence[:WORD_SEQUENCE_FRAMES],
                        "camera",
                    )
                    saved += 1
                    recording = False
                    sequence = []
                    print(f"[{saved}/{samples}] Guardado: {path.name}")
            else:
                _draw_recording_progress(
                    preview,
                    label,
                    saved,
                    samples,
                    False,
                    0,
                )

            cv2.imshow(PREVIEW_NAME, preview)

            key = cv2.waitKey(1) & 0xFF

            if key in (ord("q"), 27):
                break

            if key == 32 and not recording:
                recording = True
                sequence = []
                last_sample = 0.0
                print(
                    f"Grabando muestra {saved + 1}/{samples} "
                    f"(~{WORD_SEQUENCE_FRAMES / TARGET_FPS:.1f} s)..."
                )

            # Siguiente frame.
            ok, next_frame = cap.read()
            frame = next_frame if ok else None

    finally:
        if cap is not None:
            cap.release()
        cv2.destroyAllWindows()
        extractor.close()

    print(
        f"\nCaptura finalizada. "
        f"Muestras guardadas: {saved if 'saved' in locals() else 0}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True, help="Palabra, ej. HOLA")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--samples", type=int, default=20)
    args = parser.parse_args()
    capture(args.label, args.camera, args.samples)
