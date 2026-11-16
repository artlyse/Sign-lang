/**
 * Muestra cómo se hace una seña.
 * 1) Si existe una imagen en /public/images/lsp/<LETRA>.png se usa esa imagen.
 * 2) Si no, dibuja la mano con los landmarks de referencia del backend
 *    (tus muestras, las de otros usuarios o el dataset de entrenamiento).
 *    Las señas dinámicas (J, Ñ, Z) se animan.
 */
import { useEffect, useMemo, useState } from "react";
import { getSignReference } from "../services/training";
import type { SignReference as SignReferenceData } from "../services/training";

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];
const TIPS = new Set([4, 8, 12, 16, 20]);

const SOURCE_LABEL: Record<SignReferenceData["source"], string> = {
  user: "Tu forma de hacerla",
  community: "Muestras de otros usuarios",
  dataset: "Dataset de entrenamiento",
};

type Point = [number, number];

function toPoints(frame: number[]): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 21; i++) pts.push([frame[i * 3], frame[i * 3 + 1]]);
  return pts;
}

function HandSkeleton({ frames, size }: { frames: number[][]; size: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (frames.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % (frames.length + 8)), // pausa al final
      70,
    );
    return () => window.clearInterval(timer);
  }, [frames]);

  // Encaje común para todos los frames (conserva la trayectoria).
  const fit = useMemo(() => {
    const all = frames.flatMap(toPoints);
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY) || 1;
    const pad = size * 0.12;
    const scale = (size - pad * 2) / span;
    const offX = pad + ((size - pad * 2) - (maxX - minX) * scale) / 2;
    const offY = pad + ((size - pad * 2) - (maxY - minY) * scale) / 2;
    return (p: Point): Point => [offX + (p[0] - minX) * scale, offY + (p[1] - minY) * scale];
  }, [frames, size]);

  const frame = frames[Math.min(index, frames.length - 1)];
  const pts = toPoints(frame).map(fit);
  const trail =
    frames.length > 1
      ? frames.slice(0, Math.min(index, frames.length - 1) + 1).map((f) => fit(toPoints(f)[8]))
      : [];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" aria-hidden="true">
      {trail.length > 1 && (
        <polyline
          points={trail.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      )}
      {CONNECTIONS.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]}
          stroke="#2563eb" strokeWidth={size / 40} strokeLinecap="round"
        />
      ))}
      {pts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x} cy={y}
          r={TIPS.has(i) ? size / 32 : size / 46}
          fill={TIPS.has(i) ? "#f59e0b" : "#ffffff"}
          stroke="#2563eb" strokeWidth={size / 110}
        />
      ))}
    </svg>
  );
}

interface SignReferenceProps {
  label: string;
  size?: number;
  compact?: boolean;
  active?: boolean;
}

export default function SignReference({
  label,
  size = 180,
  compact = false,
  active = false,
}: SignReferenceProps) {
  const upper = label.toUpperCase();
  const [photoFailed, setPhotoFailed] = useState(false);
  const [data, setData] = useState<SignReferenceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setPhotoFailed(false);
    setLoading(true);
    getSignReference(upper).then((value) => {
      if (!alive) return;
      setData(value);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [upper]);

  const frames = data?.sequence ?? (data?.landmarks ? [data.landmarks] : null);

  return (
    <figure className={`sign-reference ${compact ? "compact" : ""} ${active ? "active" : ""}`}>
      <div className="sign-reference-art" style={{ width: size, height: size }}>
        {!photoFailed ? (
          <img
            src={`/images/lsp/${encodeURIComponent(upper)}.png`}
            alt={`Seña ${upper}`}
            onError={() => setPhotoFailed(true)}
          />
        ) : frames ? (
          <HandSkeleton frames={frames} size={size} />
        ) : (
          <span className="sign-reference-empty">{loading ? "…" : upper}</span>
        )}
      </div>
      <figcaption>
        <strong>{upper}</strong>
        {!compact && (
          <small>
            {!photoFailed
              ? "Observa la posición de la mano y repítela frente a la cámara"
              : data
                ? `${SOURCE_LABEL[data.source]}${data.kind === "dynamic" ? " · con movimiento" : ""}`
                : loading
                  ? "Cargando referencia..."
                  : "Sin referencia aún: practícala y confirma tus intentos"}
          </small>
        )}
      </figcaption>
    </figure>
  );
}
