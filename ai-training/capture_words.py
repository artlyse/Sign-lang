# Cambiar solo estas lineas al inicio del archivo:
SENAS = ["HOLA", "GRACIAS", "POR_FAVOR", "SI", "NO", "BUENOS_DIAS", "ADIOS"]
DATASET_PATH = os.path.join(SCRIPT_DIR, "dataset", "words")
SECUENCIAS_POR_SENA = 50
FRAMES_POR_SECUENCIA = 50   # Mas frames para palabras completas
FPS_GRABACION = 15