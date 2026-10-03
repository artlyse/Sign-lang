import numpy as np
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_ROOT = os.path.join(SCRIPT_DIR, "dataset")

# Configuracion por tipo de dataset
TIPOS = {
    "static": {
        "path": os.path.join(DATASET_ROOT, "static"),
        "forma_esperada": (63,),
        "minimo": 100
    },
    "dynamic": {
        "path": os.path.join(DATASET_ROOT, "dynamic"),
        "forma_esperada": (30, 63),
        "minimo": 30
    },
    "words": {
        "path": os.path.join(DATASET_ROOT, "words"),
        "forma_esperada": (50, 63),
        "minimo": 30
    },
    "two_hands": {
        "path": os.path.join(DATASET_ROOT, "two_hands"),
        "forma_esperada": (30, 126),
        "minimo": 30
    },
    "gestures": {
        "path": os.path.join(DATASET_ROOT, "gestures"),
        "forma_esperada": None,
        "minimo": 30
    }
}


def verificar_tipo(nombre, config):
    path = config["path"]
    forma_esperada = config["forma_esperada"]
    minimo = config["minimo"]
    
    print("\n" + "=" * 60)
    print(f"TIPO: {nombre.upper()}")
    print(f"Ruta: {path}")
    print("=" * 60)
    
    if not os.path.exists(path):
        print(f"  CARPETA NO EXISTE")
        print(f"  Crea la carpeta o captura datos primero")
        return 0, 0
    
    subcarpetas = sorted([
        d for d in os.listdir(path)
        if os.path.isdir(os.path.join(path, d))
    ])
    
    if not subcarpetas:
        print(f"  CARPETA VACIA (sin subcarpetas)")
        return 0, 0
    
    total_muestras = 0
    total_clases = 0
    problemas = []
    
    for clase in subcarpetas:
        clase_path = os.path.join(path, clase)
        archivos = [f for f in os.listdir(clase_path) if f.endswith('.npy')]
        cantidad = len(archivos)
        total_muestras += cantidad
        
        if cantidad >= minimo:
            total_clases += 1
        
        # Verificar forma del primer archivo
        forma_info = ""
        if cantidad > 0:
            try:
                data = np.load(os.path.join(clase_path, archivos[0]))
                forma_info = f" | Forma: {data.shape}"
                
                if forma_esperada and data.shape != forma_esperada:
                    forma_info += f" (ESPERADO: {forma_esperada})"
                    problemas.append(f"{clase}: forma incorrecta")
            except Exception as e:
                forma_info = f" | ERROR: {e}"
        
        if cantidad < minimo:
            estado = f"[POCAS - minimo {minimo}]"
        else:
            estado = "[OK]"
        
        print(f"  {clase}: {cantidad} muestras {estado}{forma_info}")
    
    print("-" * 60)
    print(f"  Subcarpetas: {len(subcarpetas)}")
    print(f"  Clases con datos suficientes: {total_clases}/{len(subcarpetas)}")
    print(f"  Total de muestras: {total_muestras}")
    
    if problemas:
        print(f"\n  PROBLEMAS DETECTADOS:")
        for p in problemas:
            print(f"    - {p}")
    
    return total_muestras, total_clases


def main():
    print("=" * 60)
    print("VERIFICACION COMPLETA DE DATASETS")
    print("=" * 60)
    
    resumen = {}
    for nombre, config in TIPOS.items():
        muestras, clases = verificar_tipo(nombre, config)
        resumen[nombre] = (muestras, clases)
    
    print("\n" + "=" * 60)
    print("RESUMEN GENERAL")
    print("=" * 60)
    
    total_general = 0
    for nombre, (muestras, clases) in resumen.items():
        total_general += muestras
        if muestras > 0:
            print(f"  {nombre.upper():15s}: {muestras:6d} muestras | {clases:3d} clases")
        else:
            print(f"  {nombre.upper():15s}: SIN DATOS")
    
    print("-" * 60)
    print(f"  TOTAL GENERAL: {total_general} muestras")
    print("=" * 60)


if __name__ == "__main__":
    main()