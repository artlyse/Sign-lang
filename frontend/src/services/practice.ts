/**
 * Cliente REST del módulo de práctica.
 */

import { authenticatedFetch, readApiError } from "./auth";
import type { PersonalModelStatus, TrainingSampleInput } from "./training";

export type PracticeMode = "letter" | "word" | "phrase";
export type PracticeDifficulty = "beginner" | "intermediate" | "advanced";

export type PracticeChallenge = {
  mode: PracticeMode;
  difficulty: PracticeDifficulty;
  text: string;
  source: "library" | "qwen" | "fallback";
};

export type PracticeProgress = {
  level: number;
  total_xp: number;
  level_xp: number;
  next_level_xp: number;
  level_progress: number;
  total_attempts: number;
  successful_attempts: number;
  success_rate: number;
  current_streak: number;
  best_streak: number;
  average_accuracy: number;
  best_accuracy: number;
};

export type PracticeAttempt = {
  id: number;
  mode: PracticeMode;
  difficulty: PracticeDifficulty;
  target_text: string;
  recognized_text: string;
  accuracy: number;
  confidence: number;
  duration_ms: number;
  xp_earned: number;
  success: boolean;
  created_at: string | null;
};

export type PracticeAttemptResult = {
  attempt: PracticeAttempt;
  progress: PracticeProgress;
  level_up: boolean;
  badge: string | null;
  training?: {
    saved: number;
    skipped: number;
    verified: boolean;
    reason?: string;
    language_feedback?: number;
    personal_model?: PersonalModelStatus;
  } | null;
};

export async function getPracticeChallenge(
  mode: PracticeMode,
  difficulty: PracticeDifficulty,
  useAi = true,
): Promise<PracticeChallenge> {
  const params = new URLSearchParams({
    mode,
    difficulty,
    use_ai: String(useAi),
  });

  const response = await authenticatedFetch(
    `/api/practice/challenge?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(await readApiError(response, "No se pudo generar el ejercicio"));
  }

  return response.json();
}

export async function getPracticeProgress(): Promise<{
  progress: PracticeProgress;
  recent_attempts: PracticeAttempt[];
}> {
  const response = await authenticatedFetch("/api/practice/progress");

  if (!response.ok) {
    throw new Error("No se pudo cargar el progreso");
  }

  return response.json();
}

export async function savePracticeAttempt(payload: {
  mode: PracticeMode;
  difficulty: PracticeDifficulty;
  target_text: string;
  recognized_text: string;
  duration_ms: number;
  confidence: number;
  samples?: TrainingSampleInput[];
}): Promise<PracticeAttemptResult> {
  const response = await authenticatedFetch("/api/practice/attempt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "No se pudo guardar el intento"));
  }

  return response.json();
}
