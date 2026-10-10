/**
 * Extracción de 192 features por frame para modo Palabra. Debe coincidir con ai-training/word_mode/feature_extractor.py.
 */

export const WORD_FEATURE_DIM = 192;
export const WORD_SEQUENCE_FRAMES = 30;

export const POSE_MODEL_URL =
  import.meta.env.VITE_POSE_MODEL_URL ??
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
};

type HandResultLike = {
  landmarks?: Landmark[][];
  handednesses?: Array<Array<{ categoryName?: string; displayName?: string }>>;
  handedness?: Array<Array<{ categoryName?: string; displayName?: string }>>;
};

type PoseResultLike = {
  landmarks?: Landmark[][];
};

const POSE_INDEXES = [
  0,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
] as const;

function distance3(a: Landmark, b: Landmark) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function bodyReference(pose?: Landmark[]) {
  const leftShoulder = pose?.[11];
  const rightShoulder = pose?.[12];

  if (leftShoulder && rightShoulder) {
    const scale = Math.max(distance3(leftShoulder, rightShoulder), 0.08);
    return {
      center: {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
        z: (leftShoulder.z + rightShoulder.z) / 2,
      },
      scale,
    };
  }

  return {
    center: { x: 0.5, y: 0.5, z: 0 },
    scale: 1,
  };
}

function zeroHand() {
  return new Array<number>(66).fill(0);
}

function handFeatures(
  landmarks: Landmark[] | undefined,
  center: Landmark,
  bodyScale: number,
) {
  if (!landmarks || landmarks.length !== 21) return zeroHand();

  const wrist = landmarks[0];
  let localScale = 0;
  for (const point of landmarks) {
    localScale = Math.max(localScale, distance3(point, wrist));
  }
  localScale = Math.max(localScale, 0.04);

  const local = landmarks.flatMap((point) => [
    (point.x - wrist.x) / localScale,
    (point.y - wrist.y) / localScale,
    (point.z - wrist.z) / localScale,
  ]);

  const globalWrist = [
    (wrist.x - center.x) / bodyScale,
    (wrist.y - center.y) / bodyScale,
    (wrist.z - center.z) / bodyScale,
  ];

  return [...local, ...globalWrist];
}

function poseFeatures(
  pose: Landmark[] | undefined,
  center: Landmark,
  bodyScale: number,
) {
  if (!pose || pose.length < 25) {
    return new Array<number>(POSE_INDEXES.length * 4).fill(0);
  }

  return POSE_INDEXES.flatMap((index) => {
    const point = pose[index];
    if (!point) return [0, 0, 0, 0];

    return [
      (point.x - center.x) / bodyScale,
      (point.y - center.y) / bodyScale,
      (point.z - center.z) / bodyScale,
      Number(point.visibility ?? 1),
    ];
  });
}

function handLabel(result: HandResultLike, index: number) {
  const groups = result.handednesses ?? result.handedness ?? [];
  const category = groups[index]?.[0];
  return String(category?.categoryName ?? category?.displayName ?? "").toLowerCase();
}

export function buildWordFrameFeatures(
  handResult: HandResultLike,
  poseResult: PoseResultLike,
) {
  const pose = poseResult.landmarks?.[0];
  const { center, scale } = bodyReference(pose);
  const hands = handResult.landmarks ?? [];

  let left: Landmark[] | undefined;
  let right: Landmark[] | undefined;
  const unassigned: Landmark[][] = [];

  hands.forEach((hand, index) => {
    const label = handLabel(handResult, index);
    if (label.includes("left")) left = hand;
    else if (label.includes("right")) right = hand;
    else unassigned.push(hand);
  });

  // Fallback para APIs/navegadores que no exponen handedness.
  for (const hand of unassigned) {
    const wristX = hand[0]?.x ?? 0.5;
    if (!left && wristX < center.x) left = hand;
    else if (!right) right = hand;
    else if (!left) left = hand;
  }

  const features = [
    ...handFeatures(left, center, scale),
    ...handFeatures(right, center, scale),
    ...poseFeatures(pose, center, scale),
  ];

  if (features.length !== WORD_FEATURE_DIM) {
    throw new Error(
      `Vector de palabra invalido: ${features.length}; esperado ${WORD_FEATURE_DIM}`,
    );
  }

  return features;
}

export function drawPoseLandmarks(
  ctx: CanvasRenderingContext2D,
  poseResult: PoseResultLike,
  width: number,
  height: number,
) {
  const pose = poseResult.landmarks?.[0];
  if (!pose) return;

  ctx.fillStyle = "#38bdf8";
  for (const index of POSE_INDEXES) {
    const point = pose[index];
    if (!point || Number(point.visibility ?? 1) < 0.35) continue;
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
