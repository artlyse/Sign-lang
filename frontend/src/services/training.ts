/**
 * Datos de entrenamiento aportados en Práctica y modelo personal.
 */
import { apiJson } from "./api";

export type TrainingSampleInput = {
  label: string;
  kind: "static" | "dynamic";
  landmarks?: number[];
  sequence?: number[][];
  predicted_label?: string | null;
  confidence?: number;
};

export type PersonalModelStatus = {
  enabled: boolean;
  active: boolean;
  active_labels: string[];
  samples_in_model: number;
  min_samples_per_label: number;
  max_weight: number;
};

export type TrainingLabelStats = {
  label: string;
  kind: "static" | "dynamic";
  total: number;
  verified: number;
  exported: number;
};

export type TrainingStats = {
  total: number;
  verified: number;
  pending: number;
  exported: number;
  community_verified: number;
  labels: TrainingLabelStats[];
  static_labels: string[];
  dynamic_labels: string[];
  personal_model: PersonalModelStatus;
  dataset_dir: string;
};

export type TrainingExport = {
  exported: number;
  by_label: Record<string, number>;
  dataset_dir: string;
  next_steps: string[];
};

export const DYNAMIC_SIGNS = ["J", "Ñ", "Z"];

export const getTrainingStats = () =>
  apiJson<TrainingStats>("/api/training/stats");

export const confirmAttemptSamples = (attemptId: number) =>
  apiJson<{ verified: number; stats: TrainingStats }>(
    `/api/training/attempts/${attemptId}/confirm`,
    { method: "POST" },
  );

export const exportTrainingDataset = () =>
  apiJson<TrainingExport>("/api/training/export", { method: "POST" });

export const deleteTrainingSamples = (label?: string) =>
  apiJson<{ deleted: number; stats: TrainingStats }>(
    `/api/training/samples${label ? `?label=${encodeURIComponent(label)}` : ""}`,
    { method: "DELETE" },
  );

export type SignReference = {
  label: string;
  kind: "static" | "dynamic";
  source: "user" | "community" | "dataset";
  samples: number;
  landmarks?: number[];
  sequence?: number[][];
};

const referenceCache = new Map<string, Promise<SignReference | null>>();

/** Forma de mano de referencia (tus muestras, comunidad o dataset). */
export function getSignReference(label: string) {
  const key = label.toUpperCase();
  if (!referenceCache.has(key)) {
    referenceCache.set(
      key,
      apiJson<SignReference>(`/api/training/reference/${encodeURIComponent(key)}`).catch(
        () => {
          referenceCache.delete(key); // reintentar más tarde
          return null;
        },
      ),
    );
  }
  return referenceCache.get(key)!;
}

export function clearSignReferenceCache() {
  referenceCache.clear();
}
