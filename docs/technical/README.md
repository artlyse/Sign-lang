# Documentación técnica de SignLang

Documentos principales:

- [CODE_MAP.md](CODE_MAP.md) — mapa de archivos y responsabilidades.
- [DATABASE.md](DATABASE.md) — tablas, relaciones y auditoría SQLite.
- [LEARNING_PIPELINE.md](LEARNING_PIPELINE.md) — cómo aprende `HOL -> HOLA` y cómo afecta el score.
- [CLEANUP_REPORT.md](CLEANUP_REPORT.md) — archivos eliminados, legado y recursos conservados.

Para comprobar la base de datos:

```powershell
cd backend
venv\Scripts\activate
python scripts\check_database.py
```

Para inspeccionar el score de una palabra sin modificar aprendizaje:

```powershell
python scripts\check_learning.py HOL --user-id 1
```
