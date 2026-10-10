r"""
Inspecciona cómo el aprendizaje personalizado afecta los scores.

Ejemplos:
    python scripts\check_learning.py HOL --user-id 1
    python scripts\check_learning.py ESTS --user-id 1 --previous HOLA

El script es de SOLO LECTURA: no registra feedback ni modifica el ranker.
"""

from __future__ import annotations

import argparse

from app.database import init_db
from app.services.language_service import language_service
from app.services.learning_context import reset_learning_user, set_learning_user


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("word", help="Secuencia cruda, por ejemplo HOL")
    parser.add_argument("--user-id", type=int, required=True)
    parser.add_argument("--previous", default=None)
    args = parser.parse_args()

    init_db()
    token = set_learning_user(args.user_id)
    try:
        context = [args.previous] if args.previous else []
        suggestions = language_service.suggest(
            args.word,
            context_words=context,
        )

        print("=" * 88)
        print(
            f"INSPECCION: {args.word.upper()} | "
            f"user_id={args.user_id} | contexto={context or '-'}"
        )
        print("=" * 88)

        if not suggestions:
            print("Sin sugerencias.")
            return

        header = (
            f"{'PALABRA':18s} {'SCORE':>7s} {'BASE':>7s} "
            f"{'ML':>7s} {'EXACTA':>8s} {'N':>3s} "
            f"{'USO':>6s} {'CTX':>6s} {'CONF':>6s}"
        )
        print(header)
        print("-" * len(header))
        for item in suggestions:
            ml = item.get("ml_probability")
            print(
                f"{item['word'][:18]:18s} "
                f"{item['score']:7.4f} "
                f"{item['base_score']:7.4f} "
                f"{(ml if ml is not None else 0.0):7.4f} "
                f"{item.get('learned_correction', 0.0):8.4f} "
                f"{item.get('learned_correction_count', 0):3d} "
                f"{item.get('personal_word', 0.0):6.3f} "
                f"{item.get('learned_context', 0.0):6.3f} "
                f"{item.get('learned_confusion', 0.0):6.3f}"
            )

        print("\nEstadisticas de aprendizaje:")
        print(language_service.learning_stats())
    finally:
        reset_learning_user(token)


if __name__ == "__main__":
    main()
