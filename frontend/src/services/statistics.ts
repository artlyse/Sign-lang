/**
 * Obtiene sesiones/predicciones y agrega métricas para Dashboard/Estadísticas.
 */

import { authenticatedFetch } from "./auth";

export type RecognitionSession = {
  id: number;
  mode: string;
  started_at: string | null;
  ended_at: string | null;
  total_predictions: number;
};

export type RecognitionPrediction = {
  id: number;
  text: string;
  confidence: number;
  mode: string;
  created_at: string | null;
};

export type RecognitionStats = {
  sessions: RecognitionSession[];
  predictions: RecognitionPrediction[];
  totalSessions: number;
  totalPredictions: number;
  averageConfidence: number;
  staticPredictions: number;
  dynamicPredictions: number;
  topRecognitions: Array<{ text: string; count: number; percentage: number }>;
  recentPredictions: RecognitionPrediction[];
};

export async function getRecognitionSessions(
  limit = 100,
): Promise<RecognitionSession[]> {
  const response = await authenticatedFetch(
    `/api/sessions?limit=${Math.min(Math.max(limit, 1), 200)}`,
  );

  if (!response.ok) {
    throw new Error("No se pudieron obtener las sesiones");
  }

  const payload = await response.json();
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function getSessionPredictions(
  sessionId: number,
  limit = 1000,
): Promise<RecognitionPrediction[]> {
  const response = await authenticatedFetch(
    `/api/sessions/${sessionId}/predictions?limit=${Math.min(
      Math.max(limit, 1),
      1000,
    )}`,
  );

  if (!response.ok) {
    throw new Error(`No se pudieron obtener las predicciones de la sesión ${sessionId}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function loadRecognitionStatistics(
  sessionLimit = 100,
): Promise<RecognitionStats> {
  const sessions = await getRecognitionSessions(sessionLimit);

  const predictionGroups = await Promise.all(
    sessions.map(async (session) => {
      try {
        return await getSessionPredictions(session.id);
      } catch (error) {
        console.warn(
          `No se pudieron cargar las predicciones de la sesión ${session.id}`,
          error,
        );
        return [];
      }
    }),
  );

  const predictions = predictionGroups.flat();
  const totalPredictions = sessions.reduce(
    (sum, session) => sum + Number(session.total_predictions || 0),
    0,
  );

  const confidences = predictions
    .map((prediction) => Number(prediction.confidence))
    .filter((value) => Number.isFinite(value));

  const averageConfidence = confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : 0;

  const staticPredictions = predictions.filter(
    (prediction) => prediction.mode === "static",
  ).length;
  const dynamicPredictions = predictions.filter(
    (prediction) => prediction.mode === "dynamic",
  ).length;

  const counts = new Map<string, number>();
  predictions.forEach((prediction) => {
    const value = String(prediction.text || "").trim().toUpperCase();
    if (!value) return;
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const counted = ranked.reduce((sum, [, count]) => sum + count, 0);
  const topRecognitions = ranked.map(([text, count]) => ({
    text,
    count,
    percentage: counted > 0 ? (count / counted) * 100 : 0,
  }));

  const recentPredictions = [...predictions]
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 8);

  return {
    sessions,
    predictions,
    totalSessions: sessions.length,
    totalPredictions,
    averageConfidence,
    staticPredictions,
    dynamicPredictions,
    topRecognitions,
    recentPredictions,
  };
}
