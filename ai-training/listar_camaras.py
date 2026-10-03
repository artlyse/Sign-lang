import cv2

def listar_camaras(max_index=5):
    print("=" * 60)
    print("DETECCION DE CAMARAS DISPONIBLES")
    print("=" * 60)
    
    disponibles = []
    
    # Backends en Windows
    backends = [
        (cv2.CAP_DSHOW, "DirectShow"),
        (cv2.CAP_MSMF, "MediaFoundation"),
        (cv2.CAP_ANY, "Default"),
    ]
    
    for idx in range(max_index):
        for backend, nombre in backends:
            try:
                cap = cv2.VideoCapture(idx, backend)
                if cap.isOpened():
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        h, w = frame.shape[:2]
                        print(f"Indice {idx} [{nombre}]: OK ({w}x{h})")
                        disponibles.append((idx, backend, nombre, w, h))
                    cap.release()
            except Exception as e:
                pass
    
    print("=" * 60)
    if disponibles:
        print(f"Camaras encontradas: {len(disponibles)}")
        print("\nPrueba cada indice en el script de captura")
    else:
        print("No se encontraron camaras")
    
    return disponibles


if __name__ == "__main__":
    listar_camaras()