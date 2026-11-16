/**
 * Registro y verificación facial de la cuenta (backend: /api/users/me/face).
 * La foto y la plantilla biométrica se guardan cifradas en la base de datos.
 */
import { apiJson } from "./api";
import { authenticatedFetch, readApiError } from "./auth";

export type FaceStatus = {
  enrolled: boolean;
  recognition_ready: boolean;
  updated_at: string | null;
  message: string;
};

export type FaceVerification = {
  verified: boolean;
  similarity: number;
  display_name: string | null;
  message: string;
};

const BASE = "/api/users/me/face";

export const getFaceStatus = () => apiJson<FaceStatus>(BASE);

const upload = async <T>(path: string, method: string, image: Blob, fallback: string) => {
  const body = new FormData();
  body.append("image", image, "rostro.jpg");
  const response = await authenticatedFetch(path, { method, body });
  if (!response.ok) throw new Error(await readApiError(response, fallback));
  return (await response.json()) as T;
};

export const saveFace = (image: Blob) =>
  upload<{ saved: boolean; message: string }>(
    `${BASE}?consent=true`,
    "PUT",
    image,
    "No se pudo registrar el rostro",
  );

export const verifyFace = (image: Blob) =>
  upload<FaceVerification>(`${BASE}/verify`, "POST", image, "No se pudo verificar el rostro");

export const deleteFace = () => apiJson<void>(BASE, { method: "DELETE" });

/** Devuelve una URL local (blob:) con la foto registrada, o null si no hay. */
export async function getFacePhotoUrl(): Promise<string | null> {
  const response = await authenticatedFetch(`${BASE}/photo`);
  if (!response.ok) return null;
  return URL.createObjectURL(await response.blob());
}

/** Captura el fotograma actual de un <video> como JPEG. */
export function captureFrame(video: HTMLVideoElement, quality = 0.9): Promise<Blob> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    return Promise.reject(new Error("La cámara todavía no está lista."));
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo capturar la imagen."))),
      "image/jpeg",
      quality,
    ),
  );
}
