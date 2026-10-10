r"""
Auditoría de la base de datos de SignLang.

Uso:
    cd backend
    venv\Scripts\activate
    python scripts\check_database.py

Este script NO modifica datos de usuario. Solo:
- crea tablas faltantes mediante `init_db()`,
- muestra tablas/filas,
- ejecuta PRAGMA integrity_check,
- ejecuta PRAGMA foreign_key_check,
- busca huérfanos en relaciones importantes,
- avisa sobre tablas legado conocidas.
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import inspect, text

from app.database import engine, init_db


LEGACY_TABLES = {
    "words": (
        "Tabla legado del corrector antiguo. El runtime actual usa Hunspell, "
        "wordfreq, custom_words.json y memoria SQL por usuario."
    ),
}


def _safe_database_location() -> str:
    if engine.dialect.name == "sqlite":
        database = engine.url.database
        return str(Path(database).resolve()) if database else ":memory:"
    # No imprimir credenciales de una URL remota.
    return f"{engine.dialect.name}://<configurado por DATABASE_URL>"


def _scalar(connection, sql: str) -> int:
    return int(connection.execute(text(sql)).scalar() or 0)


def main() -> None:
    init_db()
    inspector = inspect(engine)

    print("=" * 72)
    print("SIGNLANG - AUDITORIA DE BASE DE DATOS")
    print("=" * 72)
    print("Dialecto :", engine.dialect.name)
    print("Ubicacion:", _safe_database_location())
    print()

    tables = sorted(inspector.get_table_names())
    print(f"Tablas ({len(tables)}):")
    for table in tables:
        marker = " [LEGADO]" if table in LEGACY_TABLES else ""
        print(f" - {table}{marker}")

    with engine.connect() as connection:
        print("\nCONTEO DE FILAS")
        for table in tables:
            try:
                count = _scalar(connection, f'SELECT COUNT(*) FROM "{table}"')
                print(f" - {table:28s}: {count}")
            except Exception as exc:
                print(f" - {table:28s}: ERROR ({exc})")

        if engine.dialect.name == "sqlite":
            print("\nINTEGRIDAD SQLITE")
            integrity = connection.execute(
                text("PRAGMA integrity_check")
            ).scalar()
            print(" - integrity_check :", integrity)

            foreign_key_errors = connection.execute(
                text("PRAGMA foreign_key_check")
            ).fetchall()
            print(
                " - foreign_key_check:",
                "OK" if not foreign_key_errors else foreign_key_errors,
            )

        print("\nRELACIONES / HUERFANOS")
        orphan_checks = {
            "sessions -> users": """
                SELECT COUNT(*)
                FROM sessions s
                LEFT JOIN users u ON u.id = s.user_id
                WHERE u.id IS NULL
            """,
            "predictions -> sessions": """
                SELECT COUNT(*)
                FROM predictions p
                LEFT JOIN sessions s ON s.id = p.session_id
                WHERE p.session_id IS NOT NULL AND s.id IS NULL
            """,
            "learning_events -> users": """
                SELECT COUNT(*)
                FROM learning_events e
                LEFT JOIN users u ON u.id = e.user_id
                WHERE u.id IS NULL
            """,
            "practice_attempts -> users": """
                SELECT COUNT(*)
                FROM practice_attempts p
                LEFT JOIN users u ON u.id = p.user_id
                WHERE u.id IS NULL
            """,
            "user_corrections -> users": """
                SELECT COUNT(*)
                FROM user_corrections c
                LEFT JOIN users u ON u.id = c.user_id
                WHERE u.id IS NULL
            """,
        }

        for name, sql in orphan_checks.items():
            referenced_table = sql.split("FROM", 1)[1].split()[0]
            if referenced_table not in tables:
                print(f" - {name:30s}: OMITIDO (tabla no existe)")
                continue
            try:
                count = _scalar(connection, sql)
                print(
                    f" - {name:30s}: "
                    f"{'OK' if count == 0 else f'{count} HUERFANOS'}"
                )
            except Exception as exc:
                print(f" - {name:30s}: ERROR ({exc})")

    if any(table in LEGACY_TABLES for table in tables):
        print("\nTABLAS LEGADO")
        for table, reason in LEGACY_TABLES.items():
            if table in tables:
                print(f" - {table}: {reason}")

    print("\nNOTA DE ESQUEMA")
    print(
        "SQLAlchemy create_all() crea tablas faltantes, pero NO modifica "
        "columnas/constraints de una app.db existente. Para cambios de esquema "
        "en una BD ya creada se recomienda una migracion controlada."
    )
    print("=" * 72)


if __name__ == "__main__":
    main()
