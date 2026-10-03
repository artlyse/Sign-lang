import json
import re
import threading
import unicodedata
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func, select

from app.config import (
    LANGUAGE_LEARNING_CONFUSION_FULL_WEIGHT,
    LANGUAGE_LEARNING_MIN_CONFUSION_COUNT,
)
from app.database import SessionLocal
from app.models.learning import (
    LearningEvent,
    RankerTrainingExample,
    UserBigram,
    UserConfusion,
    UserTrigram,
    UserWordStat,
)
from app.models.user_profile import UserProfile
from app.services.learning_context import get_learning_user


class LearningService:
    """
    Aprendizaje personalizado persistido en SQL.

    - Cada cuenta tiene sus propias confusiones, bigramas, trigramas y palabras.
    - El servicio mantiene una caché RAM por usuario para NO consultar SQL por
      cada candidato de Hunspell/wordfreq.
    - La caché se invalida cuando el usuario genera nuevo feedback.
    """

    def __init__(self):
        self._cache: Dict[int, dict] = {}
        self._lock = threading.RLock()
        print("LearningService SQL listo")

    @staticmethod
    def normalize_key(text: str) -> str:
        text = (text or "").strip().upper()
        text = text.replace("Ñ", "__ENYE__")
        text = unicodedata.normalize("NFD", text)
        text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
        text = text.replace("__ENYE__", "Ñ")
        return re.sub(r"[^A-ZÑ]", "", text)

    @staticmethod
    def _alignment(observed: str, expected: str) -> List[Tuple[Optional[str], Optional[str]]]:
        a = observed
        b = expected
        rows = len(a) + 1
        cols = len(b) + 1
        dp = [[0] * cols for _ in range(rows)]

        for i in range(rows):
            dp[i][0] = i
        for j in range(cols):
            dp[0][j] = j

        for i in range(1, rows):
            for j in range(1, cols):
                substitution = 0 if a[i - 1] == b[j - 1] else 1
                dp[i][j] = min(
                    dp[i - 1][j] + 1,
                    dp[i][j - 1] + 1,
                    dp[i - 1][j - 1] + substitution,
                )

        pairs: List[Tuple[Optional[str], Optional[str]]] = []
        i, j = len(a), len(b)
        while i > 0 or j > 0:
            if i > 0 and j > 0:
                substitution = 0 if a[i - 1] == b[j - 1] else 1
                if dp[i][j] == dp[i - 1][j - 1] + substitution:
                    pairs.append((a[i - 1], b[j - 1]))
                    i -= 1
                    j -= 1
                    continue
            if i > 0 and dp[i][j] == dp[i - 1][j] + 1:
                pairs.append((a[i - 1], None))
                i -= 1
                continue
            if j > 0:
                pairs.append((None, b[j - 1]))
                j -= 1

        pairs.reverse()
        return pairs

    def _invalidate(self, user_id: int) -> None:
        with self._lock:
            self._cache.pop(user_id, None)

    def _profile_allows(self, db, user_id: int, source: str) -> bool:
        profile = db.get(UserProfile, user_id)
        if profile is None:
            return True
        if not profile.learning_enabled:
            return False
        if source.startswith("implicit") and not profile.implicit_learning_enabled:
            return False
        return True

    def _load_cache(self, user_id: int) -> dict:
        with self._lock:
            cached = self._cache.get(user_id)
            if cached is not None:
                return cached

        db = SessionLocal()
        try:
            confusions: Dict[str, Dict[str, dict]] = {}
            for row in db.scalars(
                select(UserConfusion).where(UserConfusion.user_id == user_id)
            ):
                confusions.setdefault(row.observed_char, {})[row.expected_char] = {
                    "weight": float(row.weight_sum or 0.0),
                    "occurrences": int(row.occurrences or 0),
                }

            bigrams: Dict[str, Dict[str, float]] = {}
            for row in db.scalars(
                select(UserBigram).where(UserBigram.user_id == user_id)
            ):
                bigrams.setdefault(row.first_word, {})[row.second_word] = float(
                    row.weight_sum or 0.0
                )

            trigrams: Dict[str, Dict[str, float]] = {}
            for row in db.scalars(
                select(UserTrigram).where(UserTrigram.user_id == user_id)
            ):
                key = f"{row.first_word} {row.second_word}"
                trigrams.setdefault(key, {})[row.third_word] = float(row.weight_sum or 0.0)

            feedback_count = int(
                db.scalar(
                    select(func.count(LearningEvent.id)).where(LearningEvent.user_id == user_id)
                )
                or 0
            )

            cached = {
                "confusions": confusions,
                "bigrams": bigrams,
                "trigrams": trigrams,
                "feedback_count": feedback_count,
            }
            with self._lock:
                self._cache[user_id] = cached
            return cached
        finally:
            db.close()

    @property
    def feedback_count(self) -> int:
        user_id = get_learning_user()
        if user_id is None:
            return 0
        return int(self._load_cache(user_id)["feedback_count"])

    def confusion_probability(self, observed: str, expected: str) -> float:
        user_id = get_learning_user()
        if user_id is None:
            return 0.0

        observed = self.normalize_key(observed)
        expected = self.normalize_key(expected)
        if not observed or not expected:
            return 0.0

        row = self._load_cache(user_id)["confusions"].get(observed, {})
        target = row.get(expected)
        if not target:
            return 0.0

        occurrences = int(target["occurrences"])
        total_weight = sum(float(item["weight"]) for item in row.values())
        if occurrences < LANGUAGE_LEARNING_MIN_CONFUSION_COUNT or total_weight <= 0:
            return 0.0
        return float(target["weight"]) / total_weight

    def confusion_cost(self, observed: str, expected: str) -> Optional[float]:
        user_id = get_learning_user()
        if user_id is None:
            return None

        observed = self.normalize_key(observed)
        expected = self.normalize_key(expected)
        row = self._load_cache(user_id)["confusions"].get(observed, {})
        target = row.get(expected)
        if not target:
            return None

        occurrences = int(target["occurrences"])
        total_weight = sum(float(item["weight"]) for item in row.values())
        if occurrences < LANGUAGE_LEARNING_MIN_CONFUSION_COUNT or total_weight <= 0:
            return None

        probability = float(target["weight"]) / total_weight
        reliability = min(
            1.0,
            total_weight / max(float(LANGUAGE_LEARNING_CONFUSION_FULL_WEIGHT), 1.0),
        )
        return max(0.15, 1.0 - 0.80 * probability * reliability)

    def learned_confusion_score(self, observed: str, expected: str) -> float:
        a = self.normalize_key(observed)
        b = self.normalize_key(expected)
        if not a or not b:
            return 0.0

        values = []
        for left, right in self._alignment(a, b):
            if left and right and left != right:
                values.append(self.confusion_probability(left, right))
        return sum(values) / len(values) if values else 0.0

    def context_score(self, context_words: Optional[List[str]], candidate: str) -> float:
        user_id = get_learning_user()
        if user_id is None:
            return 0.0

        context = [
            self.normalize_key(word)
            for word in (context_words or [])
            if self.normalize_key(word)
        ][-2:]
        candidate_key = self.normalize_key(candidate)
        if not context or not candidate_key:
            return 0.0

        cache = self._load_cache(user_id)
        row = cache["bigrams"].get(context[-1], {})
        maximum = max(row.values()) if row else 0.0
        bigram_score = float(row.get(candidate_key, 0.0)) / maximum if maximum else 0.0

        trigram_score = 0.0
        if len(context) >= 2:
            tri_key = f"{context[-2]} {context[-1]}"
            tri_row = cache["trigrams"].get(tri_key, {})
            tri_maximum = max(tri_row.values()) if tri_row else 0.0
            if tri_maximum:
                trigram_score = float(tri_row.get(candidate_key, 0.0)) / tri_maximum

        if trigram_score > 0:
            return min(1.0, 0.30 * bigram_score + 0.70 * trigram_score)
        return min(1.0, bigram_score)

    def record_feedback(
        self,
        raw: str,
        correct: str,
        context_words: Optional[List[str]] = None,
        predicted: Optional[str] = None,
        source: str = "user",
        weight: float = 1.0,
    ) -> dict:
        user_id = get_learning_user()
        if user_id is None:
            return {"saved": False, "reason": "usuario invitado"}

        raw_key = self.normalize_key(raw)
        correct_key = self.normalize_key(correct)
        predicted_key = self.normalize_key(predicted or "")
        context = [
            self.normalize_key(word)
            for word in (context_words or [])
            if self.normalize_key(word)
        ][-2:]
        weight = max(0.01, min(float(weight), 1.0))

        if not raw_key or not correct_key:
            return {"saved": False, "reason": "palabra vacía"}

        db = SessionLocal()
        try:
            if not self._profile_allows(db, user_id, source):
                return {"saved": False, "reason": "aprendizaje desactivado"}

            db.add(
                LearningEvent(
                    user_id=user_id,
                    raw_word=raw_key,
                    predicted_word=predicted_key or None,
                    correct_word=correct_key,
                    context_prev2=context[-2] if len(context) >= 2 else None,
                    context_prev1=context[-1] if context else None,
                    source=source,
                    weight=weight,
                )
            )

            learned_substitutions = []
            for observed, expected in self._alignment(raw_key, correct_key):
                if not observed or not expected or observed == expected:
                    continue
                row = db.scalar(
                    select(UserConfusion).where(
                        UserConfusion.user_id == user_id,
                        UserConfusion.observed_char == observed,
                        UserConfusion.expected_char == expected,
                    )
                )
                if row is None:
                    row = UserConfusion(
                        user_id=user_id,
                        observed_char=observed,
                        expected_char=expected,
                        weight_sum=0.0,
                        occurrences=0,
                    )
                    db.add(row)
                row.weight_sum = float(row.weight_sum or 0.0) + weight
                row.occurrences = int(row.occurrences or 0) + 1
                learned_substitutions.append(f"{observed}->{expected}")

            if context:
                first = context[-1]
                bigram = db.scalar(
                    select(UserBigram).where(
                        UserBigram.user_id == user_id,
                        UserBigram.first_word == first,
                        UserBigram.second_word == correct_key,
                    )
                )
                if bigram is None:
                    bigram = UserBigram(
                        user_id=user_id,
                        first_word=first,
                        second_word=correct_key,
                        weight_sum=0.0,
                        occurrences=0,
                    )
                    db.add(bigram)
                bigram.weight_sum = float(bigram.weight_sum or 0.0) + weight
                bigram.occurrences = int(bigram.occurrences or 0) + 1

            if len(context) >= 2:
                trigram = db.scalar(
                    select(UserTrigram).where(
                        UserTrigram.user_id == user_id,
                        UserTrigram.first_word == context[-2],
                        UserTrigram.second_word == context[-1],
                        UserTrigram.third_word == correct_key,
                    )
                )
                if trigram is None:
                    trigram = UserTrigram(
                        user_id=user_id,
                        first_word=context[-2],
                        second_word=context[-1],
                        third_word=correct_key,
                        weight_sum=0.0,
                        occurrences=0,
                    )
                    db.add(trigram)
                trigram.weight_sum = float(trigram.weight_sum or 0.0) + weight
                trigram.occurrences = int(trigram.occurrences or 0) + 1

            word_stat = db.scalar(
                select(UserWordStat).where(
                    UserWordStat.user_id == user_id,
                    UserWordStat.word == correct_key,
                )
            )
            if word_stat is None:
                word_stat = UserWordStat(
                    user_id=user_id,
                    word=correct_key,
                    weight_sum=0.0,
                    accepted_count=0,
                )
                db.add(word_stat)
            word_stat.weight_sum = float(word_stat.weight_sum or 0.0) + weight
            word_stat.accepted_count = int(word_stat.accepted_count or 0) + 1

            db.commit()
            self._invalidate(user_id)
            return {
                "saved": True,
                "user_id": user_id,
                "raw": raw_key,
                "correct": correct_key,
                "weight": weight,
                "source": source,
                "learned_substitutions": learned_substitutions,
            }
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def store_ranker_examples(self, feedback_uid: str, examples: List[dict]) -> None:
        user_id = get_learning_user()
        db = SessionLocal()
        try:
            for item in examples:
                db.add(
                    RankerTrainingExample(
                        user_id=user_id,
                        feedback_uid=feedback_uid,
                        word=str(item.get("word", "")),
                        features_json=json.dumps(item.get("vector", [])),
                        label=int(item.get("label", 0)),
                    )
                )
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    def recent_feedback(self, limit: int = 20) -> List[dict]:
        user_id = get_learning_user()
        if user_id is None:
            return []
        limit = max(1, min(int(limit), 200))
        db = SessionLocal()
        try:
            rows = db.scalars(
                select(LearningEvent)
                .where(LearningEvent.user_id == user_id)
                .order_by(LearningEvent.id.desc())
                .limit(limit)
            ).all()
            return [
                {
                    "id": row.id,
                    "raw": row.raw_word,
                    "predicted": row.predicted_word,
                    "correct": row.correct_word,
                    "source": row.source,
                    "weight": row.weight,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
                for row in rows
            ]
        finally:
            db.close()

    def stats(self) -> dict:
        user_id = get_learning_user()
        if user_id is None:
            return {
                "user_id": None,
                "feedback_count": 0,
                "learned_substitution_pairs": 0,
                "learned_bigram_pairs": 0,
                "learned_trigram_pairs": 0,
            }
        cache = self._load_cache(user_id)
        return {
            "user_id": user_id,
            "feedback_count": cache["feedback_count"],
            "learned_substitution_pairs": sum(
                len(targets) for targets in cache["confusions"].values()
            ),
            "learned_bigram_pairs": sum(
                len(targets) for targets in cache["bigrams"].values()
            ),
            "learned_trigram_pairs": sum(
                len(targets) for targets in cache["trigrams"].values()
            ),
        }


learning_service = LearningService()
