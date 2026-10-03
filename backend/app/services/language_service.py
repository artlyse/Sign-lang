import json
import re
import unicodedata
import uuid
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from rapidfuzz import fuzz, process

try:
    from wordfreq import top_n_list, zipf_frequency
except Exception:
    top_n_list = None
    zipf_frequency = None

from app.config import (
    LANGUAGE_BIGRAMS_PATH,
    LANGUAGE_CONFUSION_MATRIX_PATH,
    LANGUAGE_CUSTOM_WORDS_PATH,
    LANGUAGE_MAX_VOCABULARY,
    LANGUAGE_PREFIX_COMPLETION_LIMIT,
    LANGUAGE_RANKER_NEGATIVE_EXAMPLES,
    LANGUAGE_SUGGESTION_LIMIT,
)
from app.services.candidate_ranker import candidate_ranker
from app.services.dictionary_service import spanish_dictionary_service
from app.services.learning_service import learning_service


@dataclass
class WordEntry:
    display: str
    key: str
    frequency: float


class LanguageService:
    """
    Corrector/autocompletador local con aprendizaje incremental.

    Base linguistica:
      - Hunspell es_PE
      - wordfreq
      - Damerau-Levenshtein ponderado
      - matriz manual de confusiones

    Aprendizaje:
      - confusiones aprendidas desde feedback confirmado
      - bigramas/trigramas aprendidos
      - SGDClassifier incremental para reordenar candidatos
    """

    def __init__(self):
        self.confusions: Dict[str, Dict[str, float]] = {}
        self.bigrams: Dict[str, Dict[str, float]] = {}
        self.entries: Dict[str, WordEntry] = {}
        self.keys_by_length: Dict[int, List[str]] = {}
        self.prefix_index: Dict[str, List[str]] = {}

        self._load_confusions()
        self._load_bigrams()
        self._load_vocabulary()

        dictionary_state = (
            "activo" if spanish_dictionary_service.available else "fallback"
        )
        print(
            f"LanguageService listo: {len(self.entries)} palabras de frecuencia; "
            f"Hunspell={dictionary_state}; "
            f"feedback={learning_service.feedback_count}"
        )

    @staticmethod
    def normalize_key(text: str) -> str:
        text = (text or "").strip().upper()
        text = text.replace("Ñ", "__ENYE__")
        text = unicodedata.normalize("NFD", text)
        text = "".join(
            ch for ch in text if unicodedata.category(ch) != "Mn"
        )
        text = text.replace("__ENYE__", "Ñ")
        return re.sub(r"[^A-ZÑ]", "", text)

    @staticmethod
    def _read_json(path: str, default):
        try:
            with open(path, "r", encoding="utf-8") as file:
                return json.load(file)
        except Exception as exc:
            print(f"ADVERTENCIA leyendo {path}: {exc}")
            return default

    def _load_confusions(self):
        raw = self._read_json(LANGUAGE_CONFUSION_MATRIX_PATH, {})
        self.confusions = {
            self.normalize_key(observed): {
                self.normalize_key(expected): float(cost)
                for expected, cost in targets.items()
            }
            for observed, targets in raw.items()
        }

    def _load_bigrams(self):
        raw = self._read_json(LANGUAGE_BIGRAMS_PATH, {})
        self.bigrams = {
            self.normalize_key(previous): {
                self.normalize_key(next_word): float(weight)
                for next_word, weight in following.items()
            }
            for previous, following in raw.items()
        }

    def _frequency(self, word: str) -> float:
        if zipf_frequency is None:
            return 0.0
        try:
            return float(zipf_frequency(word.lower(), "es"))
        except Exception:
            return 0.0

    def _add_entry(self, display: str, frequency: float):
        key = self.normalize_key(display)
        if not key or len(key) > 30:
            return
        if len(key) == 1 and key not in {"A", "Y", "O"}:
            return

        entry = WordEntry(
            display=display.strip().upper(),
            key=key,
            frequency=float(frequency),
        )
        existing = self.entries.get(key)
        if existing is None or entry.frequency > existing.frequency:
            self.entries[key] = entry

    def _load_vocabulary(self):
        if top_n_list is not None and zipf_frequency is not None:
            try:
                for word in top_n_list("es", LANGUAGE_MAX_VOCABULARY):
                    if not word or not any(ch.isalpha() for ch in word):
                        continue
                    key = self.normalize_key(word)
                    if not key:
                        continue
                    self._add_entry(word, self._frequency(word))
            except Exception as exc:
                print(f"ADVERTENCIA cargando wordfreq: {exc}")

        custom = self._read_json(LANGUAGE_CUSTOM_WORDS_PATH, {})
        for word, frequency in custom.items():
            self._add_entry(word, min(float(frequency), 7.0))

        self.keys_by_length.clear()
        self.prefix_index.clear()

        for key in self.entries:
            self.keys_by_length.setdefault(len(key), []).append(key)
            if len(key) >= 2:
                self.prefix_index.setdefault(key[:2], []).append(key)

    @staticmethod
    def _max_edit_distance(length: int) -> int:
        if length <= 3:
            return 1
        if length <= 6:
            return 2
        if length <= 10:
            return 3
        return 4

    def _substitution_cost(self, observed: str, expected: str) -> float:
        if observed == expected:
            return 0.0

        manual_cost = self.confusions.get(observed, {}).get(expected)
        learned_cost = learning_service.confusion_cost(observed, expected)

        costs = [1.0]
        if manual_cost is not None:
            costs.append(max(0.05, min(float(manual_cost), 1.0)))
        if learned_cost is not None:
            costs.append(max(0.05, min(float(learned_cost), 1.0)))

        # Si el proyecto ya sabia de una confusion o el usuario la ha repetido,
        # usamos el menor coste conocido.
        return min(costs)

    def weighted_damerau_levenshtein(self, observed: str, expected: str) -> float:
        a = self.normalize_key(observed)
        b = self.normalize_key(expected)

        if a == b:
            return 0.0
        if not a:
            return float(len(b))
        if not b:
            return float(len(a))

        rows = len(a) + 1
        cols = len(b) + 1
        dp = [[0.0] * cols for _ in range(rows)]

        for i in range(rows):
            dp[i][0] = float(i)
        for j in range(cols):
            dp[0][j] = float(j)

        for i in range(1, rows):
            for j in range(1, cols):
                delete_cost = dp[i - 1][j] + 1.0
                insert_cost = dp[i][j - 1] + 1.0
                replace_cost = dp[i - 1][j - 1] + self._substitution_cost(
                    a[i - 1], b[j - 1]
                )
                best = min(delete_cost, insert_cost, replace_cost)

                if (
                    i > 1
                    and j > 1
                    and a[i - 1] == b[j - 2]
                    and a[i - 2] == b[j - 1]
                ):
                    best = min(best, dp[i - 2][j - 2] + 0.75)

                dp[i][j] = best

        return dp[-1][-1]

    def _static_context_score(
        self,
        context_words: Optional[List[str]],
        candidate_key: str,
    ) -> float:
        if not context_words:
            return 0.0

        previous = self.normalize_key(context_words[-1])
        options = self.bigrams.get(previous)
        if not options:
            return 0.0

        weight = options.get(candidate_key)
        if weight is None:
            return 0.0

        maximum = max(options.values()) or 1.0
        return max(0.0, min(float(weight) / float(maximum), 1.0))

    def _candidate_pool(self, raw_key: str) -> List[str]:
        max_distance = self._max_edit_distance(len(raw_key))
        pool: List[str] = []
        min_len = max(1, len(raw_key) - max_distance)
        max_len = len(raw_key) + max_distance

        for length in range(min_len, max_len + 1):
            pool.extend(self.keys_by_length.get(length, []))

        return pool

    def _prefix_completions(self, raw_key: str) -> List[str]:
        if len(raw_key) < 3:
            return []

        bucket = self.prefix_index.get(raw_key[:2], [])
        matches = [
            key
            for key in bucket
            if key.startswith(raw_key)
            and len(key) <= len(raw_key) + 8
        ]
        matches.sort(
            key=lambda key: self.entries[key].frequency,
            reverse=True,
        )
        return matches[:LANGUAGE_PREFIX_COMPLETION_LIMIT]

    def _entry_from_external_candidate(self, candidate: str) -> Optional[WordEntry]:
        key = self.normalize_key(candidate)
        if not key or len(key) > 30:
            return None

        existing = self.entries.get(key)
        if existing is not None:
            return existing

        return WordEntry(
            display=candidate.strip().upper(),
            key=key,
            frequency=self._frequency(candidate),
        )

    @staticmethod
    def _prefix_ratio(a: str, b: str) -> float:
        if not a or not b:
            return 0.0
        count = 0
        for left, right in zip(a, b):
            if left != right:
                break
            count += 1
        return count / max(len(a), len(b), 1)

    @staticmethod
    def _suffix_ratio(a: str, b: str) -> float:
        if not a or not b:
            return 0.0
        count = 0
        for left, right in zip(reversed(a), reversed(b)):
            if left != right:
                break
            count += 1
        return count / max(len(a), len(b), 1)

    def _candidate_metrics(
        self,
        raw_key: str,
        entry: WordEntry,
        context_words: Optional[List[str]],
        is_completion: bool,
        is_dictionary_candidate: bool,
    ) -> Optional[dict]:
        candidate_key = entry.key
        max_edit = self._max_edit_distance(len(raw_key))

        if is_completion and candidate_key.startswith(raw_key) and candidate_key != raw_key:
            weighted_distance = 0.0
            prefix_coverage = len(raw_key) / max(len(candidate_key), 1)
            similarity = 0.78 + 0.22 * prefix_coverage
        else:
            weighted_distance = self.weighted_damerau_levenshtein(
                raw_key,
                candidate_key,
            )
            if weighted_distance > max_edit + 0.75:
                return None
            denominator = max(len(raw_key), len(candidate_key), 1)
            similarity = max(
                0.0,
                1.0 - weighted_distance / denominator,
            )

        frequency_score = max(0.0, min(entry.frequency / 8.0, 1.0))
        static_context = self._static_context_score(context_words, candidate_key)
        learned_context = learning_service.context_score(
            context_words,
            candidate_key,
        )
        learned_confusion = learning_service.learned_confusion_score(
            raw_key,
            candidate_key,
        )

        first_letter_match = 1.0 if raw_key[0] == candidate_key[0] else 0.0
        exact = 1.0 if raw_key == candidate_key else 0.0
        prefix_ratio = self._prefix_ratio(raw_key, candidate_key)
        suffix_ratio = self._suffix_ratio(raw_key, candidate_key)
        length_similarity = 1.0 - (
            abs(len(raw_key) - len(candidate_key))
            / max(len(raw_key), len(candidate_key), 1)
        )

        base_score = (
            0.68 * similarity
            + 0.19 * frequency_score
            + 0.040 * static_context
            + 0.055 * learned_context
            + 0.020 * first_letter_match
            + 0.050 * exact
            + (0.030 if is_dictionary_candidate else 0.0)
            + (0.015 if is_completion else 0.0)
            + 0.020 * learned_confusion
        )
        base_score = max(0.0, min(base_score, 1.0))

        features = {
            "similarity": similarity,
            "frequency": frequency_score,
            "static_context": static_context,
            "learned_context": learned_context,
            "learned_confusion": learned_confusion,
            "first_letter_match": first_letter_match,
            "prefix_ratio": prefix_ratio,
            "suffix_ratio": suffix_ratio,
            "length_similarity": length_similarity,
            "dictionary": 1.0 if is_dictionary_candidate else 0.0,
            "completion": 1.0 if is_completion else 0.0,
            "exact": exact,
            "base_score": base_score,
        }

        ml_probability = candidate_ranker.predict_probability(features)
        ml_weight = candidate_ranker.effective_weight()

        if ml_probability is None or ml_weight <= 0.0:
            final_score = base_score
        else:
            final_score = (
                (1.0 - ml_weight) * base_score
                + ml_weight * ml_probability
            )

        return {
            "word": entry.display,
            "key": candidate_key,
            "score": round(float(final_score), 4),
            "base_score": round(float(base_score), 4),
            "ml_probability": (
                round(float(ml_probability), 4)
                if ml_probability is not None
                else None
            ),
            "ml_weight": round(float(ml_weight), 4),
            "distance": round(float(weighted_distance), 3),
            "similarity": round(float(similarity), 4),
            "frequency": round(float(frequency_score), 4),
            "dictionary": bool(is_dictionary_candidate),
            "completion": bool(is_completion),
            "learned_context": round(float(learned_context), 4),
            "learned_confusion": round(float(learned_confusion), 4),
            "_features": features,
        }

    def _collect_candidates(
        self,
        raw_key: str,
        context_words: Optional[List[str]],
        forced_candidate: Optional[str] = None,
    ) -> List[dict]:
        candidates: Dict[str, WordEntry] = {}

        pool = self._candidate_pool(raw_key)
        if pool:
            shortlist = process.extract(
                raw_key,
                pool,
                scorer=fuzz.ratio,
                limit=140,
                score_cutoff=20,
            )
            for candidate_key, _score, _index in shortlist:
                candidates[candidate_key] = self.entries[candidate_key]

        completion_keys = set(self._prefix_completions(raw_key))
        for candidate_key in completion_keys:
            candidates[candidate_key] = self.entries[candidate_key]

        hunspell_candidates = spanish_dictionary_service.suggest(raw_key)
        for candidate in hunspell_candidates:
            entry = self._entry_from_external_candidate(candidate)
            if entry:
                candidates[entry.key] = entry

        raw_is_dictionary_word = spanish_dictionary_service.lookup(raw_key)
        raw_entry = self.entries.get(raw_key)
        if raw_entry is None and raw_is_dictionary_word:
            raw_entry = WordEntry(raw_key, raw_key, self._frequency(raw_key))
        if raw_entry is not None:
            candidates[raw_key] = raw_entry

        forced_key = self.normalize_key(forced_candidate or "")
        if forced_key:
            forced_entry = self._entry_from_external_candidate(forced_candidate or "")
            if forced_entry is None:
                forced_entry = WordEntry(
                    display=(forced_candidate or forced_key).strip().upper(),
                    key=forced_key,
                    frequency=self._frequency(forced_candidate or forced_key),
                )
            candidates[forced_key] = forced_entry

        hunspell_keys = {
            self.normalize_key(candidate)
            for candidate in hunspell_candidates
        }

        scored = []
        for candidate_key, entry in candidates.items():
            is_completion = (
                candidate_key in completion_keys
                and candidate_key != raw_key
            )
            is_dictionary_candidate = (
                candidate_key in hunspell_keys
                or spanish_dictionary_service.lookup(entry.display)
            )

            metrics = self._candidate_metrics(
                raw_key,
                entry,
                context_words,
                is_completion,
                is_dictionary_candidate,
            )
            if metrics is not None:
                scored.append(metrics)

        scored.sort(key=lambda item: item["score"], reverse=True)
        return scored

    def suggest(
        self,
        raw_word: str,
        previous_word: Optional[str] = None,
        context_words: Optional[List[str]] = None,
        limit: int = LANGUAGE_SUGGESTION_LIMIT,
    ) -> List[dict]:
        raw_key = self.normalize_key(raw_word)
        if not raw_key:
            return []

        if context_words is None:
            context_words = [previous_word] if previous_word else []

        scored = self._collect_candidates(raw_key, context_words)

        results = []
        for item in scored[:limit]:
            clean = dict(item)
            clean.pop("_features", None)
            results.append(clean)
        return results

    def learn_from_feedback(
        self,
        raw: str,
        correct: str,
        context_words: Optional[List[str]] = None,
        predicted: Optional[str] = None,
        source: str = "user",
        weight: float = 1.0,
        train_ranker: bool = True,
    ) -> dict:
        """
        Registra una correccion confirmada y actualiza:
          1. SGD ranker
          2. confusiones de letras
          3. bigramas/trigramas
        """
        raw_key = self.normalize_key(raw)
        correct_key = self.normalize_key(correct)
        if not raw_key or not correct_key:
            return {"saved": False, "reason": "palabra vacia"}

        # IMPORTANTE: las features para entrenar se calculan ANTES de registrar
        # este mismo feedback para evitar que la muestra se explique a si misma.
        training_candidates = self._collect_candidates(
            raw_key,
            context_words or [],
            forced_candidate=correct,
        )

        positive = None
        negatives = []
        for item in training_candidates:
            if item["key"] == correct_key:
                positive = item
            else:
                negatives.append(item)

        negatives.sort(key=lambda item: item["score"], reverse=True)
        negatives = negatives[:LANGUAGE_RANKER_NEGATIVE_EXAMPLES]

        ranker_result = {
            "trained": False,
            "reason": "sin candidatos suficientes",
        }

        if train_ranker and positive is not None and negatives:
            feedback_id = str(uuid.uuid4())
            examples = [
                {
                    "word": positive["word"],
                    "features": positive["_features"],
                    "label": 1,
                }
            ]
            examples.extend(
                {
                    "word": item["word"],
                    "features": item["_features"],
                    "label": 0,
                }
                for item in negatives
            )
            ranker_result = candidate_ranker.learn_feedback(
                examples,
                feedback_id=feedback_id,
            )

        memory_result = learning_service.record_feedback(
            raw=raw,
            correct=correct,
            context_words=context_words or [],
            predicted=predicted,
            source=source,
            weight=weight,
        )

        return {
            "saved": bool(memory_result.get("saved")),
            "memory": memory_result,
            "ranker": ranker_result,
        }

    def learning_stats(self) -> dict:
        return {
            "memory": learning_service.stats(),
            "ranker": candidate_ranker.stats(),
        }

    def recent_feedback(self, limit: int = 20) -> List[dict]:
        return learning_service.recent_feedback(limit=limit)

    def is_dictionary_word(self, word: str) -> bool:
        """True si Hunspell es_PE reconoce la palabra tal como fue escrita."""
        return spanish_dictionary_service.lookup(word)

    def dictionary_status(self) -> dict:
        status = spanish_dictionary_service.status()
        status["frequency_vocabulary_size"] = len(self.entries)
        status["learning"] = self.learning_stats()
        return status


language_service = LanguageService()
