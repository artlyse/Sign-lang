/**
 * Estadísticas del aprendizaje lingüístico persistido por usuario.
 */
import { apiJson } from "./api";

export type LearningStats = {
  memory?: {
    feedback_count: number;
    learned_exact_correction_pairs: number;
    learned_substitution_pairs: number;
    personal_words: number;
    learned_bigram_pairs: number;
    learned_trigram_pairs: number;
  };
  ranker?: {
    fitted: boolean;
    trained_feedback: number;
    effective_weight: number;
    warmup_feedback: number;
  };
};

export const getLearningStats = () =>
  apiJson<LearningStats>("/api/learning/stats");
