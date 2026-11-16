/**
 * Ilustración SVG de una mano con los 21 landmarks de MediaPipe.
 * Se usa en Login, Registro y en el banner del Dashboard.
 */
import { useId } from "react";

type Point = [number, number];

// Mano abierta (seña "Hola") en un lienzo 300x300.
const LANDMARKS: Point[] = [
  [150, 272], // 0 muñeca
  [112, 248], [86, 218], [68, 190], [54, 162], // pulgar
  [116, 166], [109, 121], [105, 93], [102, 66], // índice
  [146, 158], [146, 109], [146, 77], [146, 48], // medio
  [176, 163], [182, 119], [186, 91], [189, 66], // anular
  [202, 179], [214, 147], [222, 126], [228, 105], // meñique
];

const FINGERS = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const PALM = [0, 1, 5, 9, 13, 17]
  .map((i) => LANDMARKS[i].join(","))
  .join(" ");

const TIPS = new Set([4, 8, 12, 16, 20]);

interface HandIllustrationProps {
  className?: string;
  /** Muestra marco de cámara y línea de escaneo */
  scanner?: boolean;
  /** Dibuja los puntos y conexiones de MediaPipe */
  skeleton?: boolean;
  /** Color sólido de la mano (versión plana) */
  fill?: string;
}

export default function HandIllustration({
  className,
  scanner = true,
  skeleton = true,
  fill,
}: HandIllustrationProps) {
  const uid = useId().replace(/:/g, "");
  const skin = `hand-skin-${uid}`;
  const line = `hand-line-${uid}`;
  const glow = `hand-glow-${uid}`;

  return (
    <svg
      className={className}
      viewBox="0 0 300 300"
      role="img"
      aria-label="Mano con puntos de referencia detectados"
    >
      <defs>
        <linearGradient id={skin} gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="300">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#dbe7ff" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={line} gradientUnits="userSpaceOnUse" x1="50" y1="40" x2="240" y2="280">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Silueta de la mano */}
      <g opacity={fill ? 1 : 0.9}>
        <polygon points={PALM} fill={fill ?? `url(#${skin})`} stroke={fill ?? `url(#${skin})`} strokeWidth="34" strokeLinejoin="round" />
        {FINGERS.map((finger) => (
          <polyline
            key={finger.join("-")}
            points={finger.map((i) => LANDMARKS[i].join(",")).join(" ")}
            fill="none"
            stroke={fill ?? `url(#${skin})`}
            strokeWidth={finger[0] === 0 ? 30 : finger[0] === 17 ? 22 : 26}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <rect x="122" y="262" width="56" height="40" rx="14" fill={fill ?? `url(#${skin})`} />
      </g>

      {/* Esqueleto MediaPipe */}
      {skeleton && (
      <g filter={`url(#${glow})`}>
        {CONNECTIONS.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={LANDMARKS[a][0]}
            y1={LANDMARKS[a][1]}
            x2={LANDMARKS[b][0]}
            y2={LANDMARKS[b][1]}
            stroke={`url(#${line})`}
            strokeWidth="3"
            strokeLinecap="round"
          />
        ))}
        {LANDMARKS.map(([x, y], i) => (
          <circle
            key={i}
            className={TIPS.has(i) ? "hand-tip" : undefined}
            cx={x}
            cy={y}
            r={TIPS.has(i) ? 6 : 4.5}
            fill={TIPS.has(i) ? "#f472b6" : "#ffffff"}
            stroke="#6366f1"
            strokeWidth="2"
          />
        ))}
      </g>
      )}

      {scanner && (
        <g className="hand-scanner">
          <path d="M20 60 V20 H60 M240 20 H280 V60 M280 240 V280 H240 M60 280 H20 V240" fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="4" strokeLinecap="round" />
          <rect className="hand-scan-line" x="26" y="30" width="248" height="3" rx="1.5" fill="#22d3ee" />
        </g>
      )}
    </svg>
  );
}
