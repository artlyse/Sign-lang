"""Descarga una sola vez el diccionario Hunspell es_PE de LibreOffice.

Uso desde la carpeta backend:
    python scripts/download_spanish_dictionary.py

Despues de descargarlo, la aplicacion funciona completamente offline.
"""

from pathlib import Path
from urllib.request import Request, urlopen

BASE_URL = "https://raw.githubusercontent.com/LibreOffice/dictionaries/master/es"
FILES = ["es_PE.aff", "es_PE.dic", "LICENSE.md", "README_hunspell_es.txt"]

BACKEND_DIR = Path(__file__).resolve().parents[1]
TARGET_DIR = BACKEND_DIR / "app" / "data" / "hunspell"
TARGET_DIR.mkdir(parents=True, exist_ok=True)


def download(name: str):
    url = f"{BASE_URL}/{name}"
    target = TARGET_DIR / name

    print(f"Descargando {name} ...")
    request = Request(url, headers={"User-Agent": "sign-language-project/1.0"})

    with urlopen(request, timeout=60) as response:
        target.write_bytes(response.read())

    print(f"OK: {target}")


def main():
    for filename in FILES:
        download(filename)

    print("\nDiccionario es_PE instalado correctamente.")
    print("Reinicia el backend para cargarlo.")


if __name__ == "__main__":
    main()
