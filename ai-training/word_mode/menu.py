"""Menú de consola del pipeline de palabras.

Centraliza captura por cámara, importación de video, entrenamiento y
re-exportación ONNX usando el mismo entorno virtual del backend."""

from __future__ import annotations

from pathlib import Path

from collect_camera import capture
from import_video import import_video
from train_word_model import train
from export_word_model import export_last_model


def ask_label():
    return input("Palabra/etiqueta (ej. HOLA): ").strip().upper()


def choose_videos():
    try:
        from tkinter import Tk, filedialog

        root = Tk()
        root.withdraw()
        paths = filedialog.askopenfilenames(
            title="Selecciona uno o varios videos de la misma seña",
            filetypes=[
                ("Videos", "*.mp4 *.avi *.mov *.mkv *.webm"),
                ("Todos", "*.*"),
            ],
        )
        root.destroy()
        return list(paths)
    except Exception:
        path = input("Ruta del video: ").strip().strip('"')
        return [path] if path else []


def main():
    while True:
        print("\n" + "=" * 55)
        print("SIGNLANG - ENTRENAMIENTO MODO PALABRA")
        print("=" * 55)
        print("1. Capturar muestras con CAMARA")
        print("2. Importar muestra desde VIDEO")
        print("3. Entrenar y exportar modelo ONNX")
        print("4. Exportar ultimo word_model.pt a ONNX")
        print("5. Salir")
        option = input("Opcion: ").strip()

        try:
            if option == "1":
                label = ask_label()
                camera = int(input("Indice de camara [0]: ").strip() or "0")
                samples = int(input("Cantidad de muestras [20]: ").strip() or "20")
                capture(label, camera, samples)
            elif option == "2":
                label = ask_label()
                paths = choose_videos()
                for path in paths:
                    import_video(label, path)
                if paths:
                    print(f"Videos importados para {label}: {len(paths)}")
            elif option == "3":
                epochs = int(input("Epochs [55]: ").strip() or "55")
                train(epochs=epochs)
            elif option == "4":
                export_last_model()

            elif option == "5":
                break
            else:
                print("Opcion invalida")
        except Exception as exc:
            print(f"ERROR: {exc}")


if __name__ == "__main__":
    main()
