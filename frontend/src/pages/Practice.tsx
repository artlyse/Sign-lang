/**
 * Módulo gamificado de práctica. Ejecuta retos por letra/palabra/frase, mide tiempo/precisión y persiste progreso.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

import { API_URL, getAccessToken } from "../services/auth";
import {
  getPracticeChallenge,
  getPracticeProgress,
  savePracticeAttempt,
} from "../services/practice";
import type {
  PracticeAttempt,
  PracticeAttemptResult,
  PracticeDifficulty,
  PracticeMode,
  PracticeProgress,
} from "../services/practice";
import useTextToSpeech from "../hooks/useTextToSpeech";
import {
  BrainCircuit,
  Camera,
  CaseUpper,
  Check,
  CheckCircle2,
  Flame,
  Hand,
  History,
  Loader2,
  Medal,
  MessageSquareText,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Square,
  Target,
  Timer,
  Users,
  Volume2,
  WholeWord,
} from "lucide-react";
import {
  confirmAttemptSamples,
  deleteTrainingSamples,
  DYNAMIC_SIGNS,
  exportTrainingDataset,
  getTrainingStats,
} from "../services/training";
import type {
  TrainingSampleInput,
  TrainingStats,
} from "../services/training";
import TrainingPanel from "../components/TrainingPanel";
import SignReference from "../components/SignReference";
import { clearSignReferenceCache } from "../services/training";
import {
  buildWordFrameFeatures,
  drawPoseLandmarks,
  POSE_MODEL_URL,
} from "../services/wordVision";

const MODEL_URL = "/hand_landmarker.task";
const RECOGNITION_FPS = 30;
const WORD_RECOGNITION_FPS = 15;
const SEND_INTERVAL_MS = 1000 / RECOGNITION_FPS;
const WORD_SEND_INTERVAL_MS = 1000 / WORD_RECOGNITION_FPS;
const WORD_GAP_MS = 900;

const WS_BASE =
  import.meta.env.VITE_WS_URL ??
  `${API_URL.replace(/^http/, "ws")}/ws/recognition`;

type LanguageState = {
  raw_word?: string;
  resolved_word?: string;
  preview_word?: string;
  sentence_words?: string[];
  sentence?: string;
  display_text?: string;
  event?: {
    type?: string;
    letter?: string;
    confidence?: number;
  } | null;
};

const EMPTY_PROGRESS: PracticeProgress = {
  level: 1,
  total_xp: 0,
  level_xp: 0,
  next_level_xp: 300,
  level_progress: 0,
  total_attempts: 0,
  successful_attempts: 0,
  success_rate: 0,
  current_streak: 0,
  best_streak: 0,
  average_accuracy: 0,
  best_accuracy: 0,
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-ZÑ0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LOCAL_LIBRARY: Record<PracticeMode, Record<PracticeDifficulty, string[]>> = {
  letter: {
    beginner: "AEILMNOSTU".split(""),
    intermediate: "BCDFGHKPRV".split(""),
    advanced: ["J", "Ñ", "Q", "W", "X", "Y", "Z"],
  },
  word: {
    beginner: ["HOLA", "CASA", "AGUA", "AMOR", "MANO", "DIA", "MAMA", "PAPA", "AMIGO", "GRACIAS"],
    intermediate: ["FAMILIA", "ESCUELA", "TRABAJO", "COMIDA", "TIEMPO", "PERSONA", "SALUD", "CAMINO", "CIUDAD", "AYUDA"],
    advanced: ["COMUNICACION", "APRENDIZAJE", "UNIVERSIDAD", "TECNOLOGIA", "EXPERIENCIA", "DESARROLLO", "INFORMACION"],
  },
  phrase: {
    beginner: ["HOLA COMO ESTAS", "BUENOS DIAS AMIGO", "QUIERO TOMAR AGUA", "GRACIAS POR TU AYUDA"],
    intermediate: ["HOLA COMO ESTAN TODOS", "QUIERO APRENDER LENGUA DE SEÑAS", "GRACIAS POR AYUDARME CON ESTO"],
    advanced: ["LA COMUNICACION ACCESIBLE MEJORA LA EXPERIENCIA DE TODOS", "EL APRENDIZAJE CONSTANTE AYUDA A MEJORAR LA FLUIDEZ"],
  },
};

const ALPHABET = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

const DIFFICULTY_LABEL: Record<PracticeDifficulty, string> = {
  beginner: "Inicial",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

function pickLocalChallenge(
  mode: PracticeMode,
  difficulty: PracticeDifficulty,
  previous = "",
) {
  const options = LOCAL_LIBRARY[mode][difficulty].filter((item) => item !== previous);
  return options[Math.floor(Math.random() * options.length)] ?? previous;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Tiempo de espera agotado")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

type BufferedFrame = {
  t: number;
  landmarks: number[];
  predicted?: string;
  confidence?: number;
};

const FRAME_BUFFER_SIZE = 120; // ~4 s a 30 FPS
const MAX_STATIC_SAMPLES = 8;

function pickEvenly<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const step = (items.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => items[Math.round(i * step)]);
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, ms) / 1000;
  return `${seconds.toFixed(1)} s`;
}

function Practice() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationRef = useRef<number>(0);
  const lastSentAtRef = useRef(0);
  const frameInFlightRef = useRef(false);
  const hadHandRef = useRef(false);
  const wordGapTimerRef = useRef<number | null>(null);
  const startAtRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const confidenceSumRef = useRef(0);
  const confidenceCountRef = useRef(0);
  const recognitionEngineRef = useRef<"letter" | "word">("letter");
  // Landmarks capturados durante el reto para entrenar el modelo.
  const frameBufferRef = useRef<BufferedFrame[]>([]);
  const letterSamplesRef = useRef<TrainingSampleInput[]>([]);

  const [mode, setMode] = useState<PracticeMode>("letter");
  const [difficulty, setDifficulty] =
    useState<PracticeDifficulty>("beginner");
  const [target, setTarget] = useState("");
  const [challengeSource, setChallengeSource] = useState("");
  const [loadingChallenge, setLoadingChallenge] = useState(false);

  const [connected, setConnected] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Iniciando cámara...");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [recognitionEngine, setRecognitionEngine] =
    useState<"letter" | "word">("letter");
  const [currentLetter, setCurrentLetter] = useState("-");
  const [confidence, setConfidence] = useState(0);
  const [recognizedText, setRecognizedText] = useState("");

  const [active, setActive] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<PracticeAttemptResult | null>(null);
  const [saving, setSaving] = useState(false);

  const [progress, setProgress] =
    useState<PracticeProgress>(EMPTY_PROGRESS);
  const [recentAttempts, setRecentAttempts] =
    useState<PracticeAttempt[]>([]);
  const [error, setError] = useState("");

  const [contribute, setContribute] = useState(
    () => localStorage.getItem("practice_contribute") !== "false",
  );
  const contributeRef = useRef(contribute);
  const [personalized, setPersonalized] = useState(false);
  const [trainingStats, setTrainingStats] = useState<TrainingStats | null>(null);
  const [trainingBusy, setTrainingBusy] = useState(false);
  const [trainingMessage, setTrainingMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { speak, supported: ttsSupported } = useTextToSpeech();

  const showLandmarks =
    localStorage.getItem("show_landmarks") !== "false";

  const wsUrl = useMemo(() => {
    const token = getAccessToken();
    if (!token) return WS_BASE;
    const separator = WS_BASE.includes("?") ? "&" : "?";
    return `${WS_BASE}${separator}token=${encodeURIComponent(token)}`;
  }, []);

  const sendCommand = (payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const clearWordTimer = () => {
    if (wordGapTimerRef.current !== null) {
      window.clearTimeout(wordGapTimerRef.current);
      wordGapTimerRef.current = null;
    }
  };

  const loadCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((item) => item.kind === "videoinput");
      setCameras(videoDevices);
      return videoDevices;
    } catch (err) {
      console.error("No se pudieron enumerar cámaras:", err);
      return [];
    }
  };

  useEffect(() => {
    if (mode === "letter" && recognitionEngine === "word") {
      setRecognitionEngine("letter");
    }
  }, [mode, recognitionEngine]);

  useEffect(() => {
    recognitionEngineRef.current = recognitionEngine;
    setCurrentLetter("-");
    setConfidence(0);
    setRecognizedText("");
    sendCommand({ mode: "clear_language" });
    sendCommand({ mode: "reset" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognitionEngine]);

  const displayRecognized = (state: LanguageState) => {
    const finalized = state.sentence_words?.join(" ").trim() ?? "";
    const current =
      state.resolved_word ||
      state.preview_word ||
      state.raw_word ||
      "";

    return [finalized, current].filter(Boolean).join(" ").trim();
  };

  useEffect(() => {
    getPracticeProgress()
      .then((payload) => {
        setProgress(payload.progress);
        setRecentAttempts(payload.recent_attempts);
      })
      .catch((err) => {
        console.error(err);
        setError("No se pudo cargar el progreso de práctica.");
      });
  }, []);

  const refreshTrainingStats = () =>
    getTrainingStats()
      .then((stats) => {
        clearSignReferenceCache(); // las nuevas muestras cambian la referencia
        setTrainingStats(stats);
      })
      .catch((err) => console.warn("Sin estadísticas de entrenamiento:", err));

  useEffect(() => {
    refreshTrainingStats();
  }, []);

  useEffect(() => {
    contributeRef.current = contribute;
    localStorage.setItem("practice_contribute", String(contribute));
  }, [contribute]);

  const buildSamples = (): TrainingSampleInput[] => {
    if (!contributeRef.current || recognitionEngine !== "letter") return [];

    if (mode !== "letter") {
      return letterSamplesRef.current.slice(0, 40);
    }

    const label = normalize(target);
    const frames = frameBufferRef.current;
    if (!label || !frames.length) return [];
    const lastT = frames[frames.length - 1].t;

    if (DYNAMIC_SIGNS.includes(label)) {
      // Secuencia de 30 frames de los últimos ~2.5 s (formato del LSTM).
      const window = frames.filter((f) => f.t >= lastT - 2500);
      if (window.length < 15) return [];
      return [
        {
          label,
          kind: "dynamic",
          sequence: Array.from(
            { length: 30 },
            (_, i) => window[Math.round((i * (window.length - 1)) / 29)].landmarks,
          ),
          predicted_label: currentLetter,
          confidence,
        },
      ];
    }

    // Seña estática: varias tomas de los últimos ~1.5 s.
    const recent = frames.filter((f) => f.t >= lastT - 1500);
    return pickEvenly(recent, MAX_STATIC_SAMPLES).map((f) => ({
      label,
      kind: "static" as const,
      landmarks: f.landmarks,
      predicted_label: f.predicted ?? null,
      confidence: f.confidence ?? 0,
    }));
  };

  const confirmSamples = async () => {
    if (!result) return;
    setTrainingBusy(true);
    try {
      const response = await confirmAttemptSamples(result.attempt.id);
      setTrainingStats(response.stats);
      setConfirmed(true);
      setTrainingMessage(
        `${response.verified} muestras de "${result.attempt.target_text}" añadidas a tu modelo.`,
      );
    } catch (err) {
      setTrainingMessage(err instanceof Error ? err.message : "No se pudo confirmar.");
    } finally {
      setTrainingBusy(false);
    }
  };

  const exportDataset = async () => {
    setTrainingBusy(true);
    try {
      const response = await exportTrainingDataset();
      setTrainingMessage(
        response.exported
          ? `${response.exported} muestras exportadas a ${response.dataset_dir}. Ejecuta los scripts de ai-training/training para reentrenar.`
          : "No hay muestras nuevas verificadas para exportar.",
      );
      refreshTrainingStats();
    } catch (err) {
      setTrainingMessage(err instanceof Error ? err.message : "No se pudo exportar.");
    } finally {
      setTrainingBusy(false);
    }
  };

  const resetSamples = async (label?: string) => {
    const question = label
      ? `¿Borrar tus muestras de "${label}"?`
      : "¿Borrar todas tus muestras de entrenamiento?";
    if (!window.confirm(question)) return;
    setTrainingBusy(true);
    try {
      const response = await deleteTrainingSamples(label);
      setTrainingStats(response.stats);
      setTrainingMessage(`${response.deleted} muestras eliminadas.`);
    } catch (err) {
      setTrainingMessage(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setTrainingBusy(false);
    }
  };

  const challengeRequestRef = useRef(0);

  const resetForChallenge = () => {
    setError("");
    setResult(null);
    setRecognizedText("");
    setCurrentLetter("-");
    setElapsedMs(0);
    sendCommand({ mode: "clear_language" });
  };

  const loadChallenge = async (
    nextMode = mode,
    nextDifficulty = difficulty,
  ) => {
    const requestId = ++challengeRequestRef.current;
    resetForChallenge();

    // Letras: se eligen al instante, sin depender del backend.
    if (nextMode === "letter") {
      setTarget((previous) => pickLocalChallenge("letter", nextDifficulty, previous));
      setChallengeSource("library");
      setLoadingChallenge(false);
      return;
    }

    setLoadingChallenge(true);
    try {
      const challenge = await withTimeout(
        getPracticeChallenge(nextMode, nextDifficulty, nextMode === "phrase"),
        nextMode === "phrase" ? 9000 : 4000,
      );
      if (requestId !== challengeRequestRef.current) return;
      setTarget(challenge.text);
      setChallengeSource(challenge.source);
    } catch (err) {
      if (requestId !== challengeRequestRef.current) return;
      console.warn("Reto local por fallo del backend:", err);
      setTarget((previous) => pickLocalChallenge(nextMode, nextDifficulty, previous));
      setChallengeSource("local");
    } finally {
      if (requestId === challengeRequestRef.current) setLoadingChallenge(false);
    }
  };

  const chooseLetter = (letter: string) => {
    if (active) return;
    challengeRequestRef.current += 1;
    resetForChallenge();
    setLoadingChallenge(false);
    setChallengeSource("manual");
    setTarget(letter);
  };

  useEffect(() => {
    loadChallenge(mode, difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, difficulty]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    const detectLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const handLandmarker = landmarkerRef.current;

      if (!video || !canvas || !handLandmarker) {
        animationRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      if (video.readyState >= 2) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const now = performance.now();
          const handResult = handLandmarker.detectForVideo(video, now);
          const hasHands = Boolean(handResult.landmarks?.length);

          if (hasHands) {
            clearWordTimer();
            hadHandRef.current = true;

            if (showLandmarks) {
              ctx.fillStyle = "#22c55e";
              for (const hand of handResult.landmarks ?? []) {
                for (const lm of hand) {
                  ctx.beginPath();
                  ctx.arc(
                    lm.x * canvas.width,
                    lm.y * canvas.height,
                    4,
                    0,
                    Math.PI * 2,
                  );
                  ctx.fill();
                }
              }
            }

            if (
              now - lastSentAtRef.current >=
                (recognitionEngineRef.current === "word"
                  ? WORD_SEND_INTERVAL_MS
                  : SEND_INTERVAL_MS) &&
              !frameInFlightRef.current &&
              wsRef.current?.readyState === WebSocket.OPEN
            ) {
              frameInFlightRef.current = true;
              lastSentAtRef.current = now;

              if (recognitionEngineRef.current === "word") {
                const poseLandmarker = poseLandmarkerRef.current;
                if (poseLandmarker) {
                  const poseResult = poseLandmarker.detectForVideo(video, now);
                  if (showLandmarks) {
                    drawPoseLandmarks(
                      ctx,
                      poseResult,
                      canvas.width,
                      canvas.height,
                    );
                  }

                  const features = buildWordFrameFeatures(
                    handResult,
                    poseResult,
                  );

                  wsRef.current.send(
                    JSON.stringify({
                      mode: "word",
                      features,
                      timestamp_ms: now,
                      request_id: Math.floor(now),
                    }),
                  );
                } else {
                  frameInFlightRef.current = false;
                }
              } else {
                const firstHand = handResult.landmarks?.[0];
                if (firstHand) {
                  const landmarks = firstHand.flatMap((lm) => [
                    lm.x,
                    lm.y,
                    lm.z,
                  ]);

                  if (activeRef.current && contributeRef.current) {
                    const buffer = frameBufferRef.current;
                    buffer.push({ t: now, landmarks });
                    if (buffer.length > FRAME_BUFFER_SIZE) buffer.shift();
                  }

                  wsRef.current.send(
                    JSON.stringify({
                      mode: "hybrid",
                      landmarks,
                      timestamp_ms: now,
                      request_id: Math.floor(now),
                    }),
                  );
                } else {
                  frameInFlightRef.current = false;
                }
              }

              window.setTimeout(() => {
                frameInFlightRef.current = false;
              }, 220);
            }
          } else if (hadHandRef.current) {
            hadHandRef.current = false;
            frameInFlightRef.current = false;
            sendCommand({ mode: "hand_absent" });

            if (recognitionEngineRef.current === "letter") {
              clearWordTimer();
              wordGapTimerRef.current = window.setTimeout(() => {
                sendCommand({ mode: "finalize_word" });
              }, WORD_GAP_MS);
            }
          }
        }
      }

      animationRef.current = requestAnimationFrame(detectLoop);
    };

    const initialize = async () => {
      try {
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          setConnected(true);
          ws.send(JSON.stringify({ mode: "clear_language" }));
        };
        ws.onclose = () => setConnected(false);
        ws.onerror = () => setConnected(false);
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.kind === "recognition") {
              frameInFlightRef.current = false;
              if (data.letter) {
                setCurrentLetter(String(data.letter));
                const value = Number(data.confidence ?? 0);
                setConfidence(value);
                setPersonalized(Boolean(data.personalized?.changed));

                const last = frameBufferRef.current.at(-1);
                if (last && last.predicted === undefined) {
                  last.predicted = String(data.letter);
                  last.confidence = value;
                }

                if (activeRef.current) {
                  confidenceSumRef.current += value;
                  confidenceCountRef.current += 1;
                }
              }
            }

            if (data.kind === "word_recognition") {
              frameInFlightRef.current = false;
              setCurrentLetter(String(data.word || "-"));
              const value = Number(data.confidence ?? 0);
              setConfidence(value);

              if (data.error) {
                setCameraStatus(String(data.error));
              }

              if (value > 0 && activeRef.current) {
                confidenceSumRef.current += value;
                confidenceCountRef.current += 1;
              }
            }

            if (data.kind === "language" && data.language) {
              const state = data.language as LanguageState;
              const text = displayRecognized(state);
              setRecognizedText(text);

              if (
                state.event?.type === "letter_added" &&
                activeRef.current &&
                contributeRef.current
              ) {
                // En palabras/frases cada letra aceptada aporta una muestra.
                const letter = String(state.event.letter ?? "").toUpperCase();
                const frame = frameBufferRef.current.at(-1);
                if (
                  frame &&
                  letter &&
                  !DYNAMIC_SIGNS.includes(letter) &&
                  letterSamplesRef.current.length < 40
                ) {
                  letterSamplesRef.current.push({
                    label: letter,
                    kind: "static",
                    landmarks: frame.landmarks,
                    predicted_label: letter,
                    confidence: Number(state.event.confidence ?? 0),
                  });
                }
              }

              if (
                state.event?.type === "letter_added" ||
                state.event?.type === "word_sign_added"
              ) {
                const value = Number(state.event.confidence ?? 0);
                if (value > 0 && activeRef.current) {
                  confidenceSumRef.current += value;
                  confidenceCountRef.current += 1;
                }
              }
            }
          } catch (err) {
            console.error("Respuesta WS inválida:", err);
          }
        };
        wsRef.current = ws;

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        const landmarker = await HandLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
          },
        );

        const poseLandmarker = await PoseLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: POSE_MODEL_URL,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          },
        );

        if (cancelled) {
          landmarker.close();
          poseLandmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        poseLandmarkerRef.current = poseLandmarker;

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: false,
        });
        streamRef.current = stream;

        if (cancelled) return;
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings();
        if (settings?.deviceId) setSelectedCamera(settings.deviceId);
        await loadCameras();

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setCameraStatus("Cámara activa");
        detectLoop();
      } catch (err) {
        console.error(err);
        setCameraStatus("No se pudo iniciar la cámara");
      }
    };

    initialize();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationRef.current);
      clearWordTimer();
      wsRef.current?.close();
      landmarkerRef.current?.close();
      poseLandmarkerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
    };
    // La cámara y WebSocket se crean una sola vez para evitar reinicios por reto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeCamera = async (deviceId: string) => {
    try {
      setCameraStatus("Cambiando cámara...");
      streamRef.current?.getTracks().forEach((track) => track.stop());

      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = nextStream;
      if (videoRef.current) {
        videoRef.current.srcObject = nextStream;
        await videoRef.current.play();
      }

      const track = nextStream.getVideoTracks()[0];
      const settings = track?.getSettings();
      setSelectedCamera(settings?.deviceId || deviceId);
      await loadCameras();
      setCameraStatus("Cámara activa");
    } catch (err) {
      console.error(err);
      setCameraStatus("No se pudo cambiar la cámara");
    }
  };

  useEffect(() => {
    if (!active || startAtRef.current === null) return;

    const timer = window.setInterval(() => {
      setElapsedMs(performance.now() - (startAtRef.current ?? performance.now()));
    }, 100);

    return () => window.clearInterval(timer);
  }, [active]);

  const startAttempt = () => {
    if (!target || loadingChallenge) return;

    setResult(null);
    setError("");
    setRecognizedText("");
    setCurrentLetter("-");
    setElapsedMs(0);
    confidenceSumRef.current = 0;
    confidenceCountRef.current = 0;
    frameBufferRef.current = [];
    letterSamplesRef.current = [];
    setConfirmed(false);
    setTrainingMessage("");
    startAtRef.current = performance.now();
    activeRef.current = true;
    sendCommand({ mode: "clear_language" });
    setActive(true);
  };

  const finishAttempt = async () => {
    if (!active || startAtRef.current === null || saving) return;

    setSaving(true);
    activeRef.current = false;
    setActive(false);

    const duration = Math.round(
      performance.now() - startAtRef.current,
    );

    const recognized =
      mode === "letter" && recognitionEngine === "letter"
        ? currentLetter !== "-"
          ? currentLetter
          : recognizedText
        : recognizedText || (currentLetter !== "-" ? currentLetter : "");

    const averageConfidence =
      confidenceCountRef.current > 0
        ? confidenceSumRef.current / confidenceCountRef.current
        : confidence;

    try {
      const payload = await savePracticeAttempt({
        mode,
        difficulty,
        target_text: target,
        recognized_text: recognized,
        duration_ms: duration,
        confidence: Math.min(1, Math.max(0, averageConfidence)),
        samples: buildSamples(),
      });

      setResult(payload);
      if (payload.training?.saved) refreshTrainingStats();
      setProgress(payload.progress);
      setRecentAttempts((previous) => [
        payload.attempt,
        ...previous,
      ].slice(0, 8));
      setElapsedMs(duration);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el intento.",
      );
    } finally {
      setSaving(false);
      startAtRef.current = null;
    }
  };

  useEffect(() => {
    if (!active || !target) return;

    const targetNormalized = normalize(target);
    const value =
      mode === "letter" && recognitionEngine === "letter"
        ? normalize(currentLetter)
        : normalize(recognizedText || (currentLetter !== "-" ? currentLetter : ""));

    if (value && value === targetNormalized) {
      const timer = window.setTimeout(() => {
        finishAttempt();
      }, 250);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, target, currentLetter, recognizedText, mode, recognitionEngine]);

  // Letras del objetivo y la siguiente que toca hacer.
  const targetLetters = normalize(target).replace(/[^A-ZÑ]/g, "").split("");
  const doneLetters = normalize(
    recognizedText || (currentLetter !== "-" ? currentLetter : ""),
  ).replace(/[^A-ZÑ]/g, "");
  let nextLetterIndex = 0;
  while (
    nextLetterIndex < targetLetters.length &&
    doneLetters[nextLetterIndex] === targetLetters[nextLetterIndex]
  ) {
    nextLetterIndex += 1;
  }

  const readyLetters = new Set(trainingStats?.personal_model.active_labels ?? []);
  const targetClass =
    mode === "letter" ? "letter" : target.length > 18 ? "phrase" : "word";
  const sourceLabel: Record<string, string> = {
    qwen: "Frase generada con IA",
    library: "Biblioteca",
    fallback: "Biblioteca (IA no disponible)",
    local: "Biblioteca local",
    manual: "Elegida por ti",
  };

  return (
    <div className="page practice-page pr">
      <div className="pr-stats">
        <div className="pr-stat">
          <Medal size={18} />
          <div>
            <small>Nivel {progress.level}</small>
            <div className="pr-xp">
              <i style={{ width: `${Math.min(progress.level_progress, 100)}%` }} />
            </div>
            <em>{progress.level_xp}/{progress.next_level_xp} XP</em>
          </div>
        </div>
        <div className="pr-stat">
          <Sparkles size={18} />
          <div>
            <small>XP total</small>
            <strong>{progress.total_xp}</strong>
          </div>
        </div>
        <div className="pr-stat">
          <Flame size={18} />
          <div>
            <small>Racha</small>
            <strong>{progress.current_streak}</strong>
            <em>récord {progress.best_streak}</em>
          </div>
        </div>
        <div className="pr-stat">
          <Target size={18} />
          <div>
            <small>Precisión media</small>
            <strong>{progress.average_accuracy.toFixed(1)}%</strong>
          </div>
        </div>
      </div>

      <div className="pr-toolbar">
        <div className="pr-seg" role="group" aria-label="Tipo de reto">
          {(
            [
              ["letter", "Letra", CaseUpper],
              ["word", "Palabra", WholeWord],
              ["phrase", "Frase IA", MessageSquareText],
            ] as Array<[PracticeMode, string, typeof CaseUpper]>
          ).map(([value, label, Icon]) => (
            <button
              type="button"
              key={value}
              className={mode === value ? "active" : ""}
              onClick={() => !active && setMode(value)}
              disabled={active}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <div className="pr-seg" role="group" aria-label="Dificultad">
          {(Object.keys(DIFFICULTY_LABEL) as PracticeDifficulty[]).map((value) => (
            <button
              type="button"
              key={value}
              className={difficulty === value ? "active" : ""}
              onClick={() => !active && setDifficulty(value)}
              disabled={active}
            >
              {DIFFICULTY_LABEL[value]}
            </button>
          ))}
        </div>

        <div className="pr-seg" role="group" aria-label="Reconocimiento">
          <button
            type="button"
            className={recognitionEngine === "letter" ? "active" : ""}
            onClick={() => !active && setRecognitionEngine("letter")}
            disabled={active}
          >
            <Hand size={15} /> Por letras
          </button>
          <button
            type="button"
            className={recognitionEngine === "word" ? "active" : ""}
            onClick={() => !active && setRecognitionEngine("word")}
            disabled={active || mode === "letter"}
            title={
              mode === "letter"
                ? "El reto de una letra usa el modelo de letras"
                : "Reconoce cada seña como una palabra completa"
            }
          >
            <Users size={15} /> Por palabras
          </button>
        </div>

        <div className={`pr-status ${connected ? "ok" : ""}`}>
          <span />
          {connected ? "Reconocimiento conectado" : "Conectando reconocimiento..."}
        </div>
      </div>

      <div className="pr-main">
        <section className="pr-card pr-challenge">
          <div className="pr-card-head">
            <span className="pr-eyebrow">
              {mode === "letter" ? "Letra" : mode === "word" ? "Palabra" : "Frase"} ·{" "}
              {DIFFICULTY_LABEL[difficulty]}
            </span>
            <span className="pr-timer">
              <Timer size={14} /> {formatDuration(elapsedMs)}
            </span>
          </div>

          <div className={`pr-challenge-body ${mode === "letter" ? "split" : ""}`}>
            <div className={`pr-target ${targetClass}`}>
              {loadingChallenge ? (
                <span className="pr-loading">
                  <Loader2 size={18} className="spin" /> Preparando reto...
                </span>
              ) : (
                target || "-"
              )}
            </div>

            {mode === "letter" && !loadingChallenge && targetLetters[0] && (
              <SignReference label={targetLetters[0]} size={150} />
            )}
          </div>

          {mode !== "letter" && !loadingChallenge && targetLetters.length > 0 && (
            <div className="pr-strip">
              {targetLetters.slice(0, 24).map((letter, index) => (
                <SignReference
                  key={`${letter}-${index}`}
                  label={letter}
                  size={64}
                  compact
                  active={active && index === nextLetterIndex}
                />
              ))}
            </div>
          )}

          {challengeSource && !loadingChallenge && (
            <small className="pr-source">{sourceLabel[challengeSource] ?? challengeSource}</small>
          )}

          <div className="pr-actions">
            <button
              type="button"
              className="pr-btn ghost"
              onClick={() => loadChallenge()}
              disabled={loadingChallenge || active}
            >
              <Shuffle size={16} /> {mode === "letter" ? "Letra al azar" : "Nuevo reto"}
            </button>
            <button
              type="button"
              className="pr-btn ghost"
              onClick={() => speak(target)}
              disabled={!ttsSupported || !target}
            >
              <Volume2 size={16} /> Escuchar
            </button>
            {!active ? (
              <button
                type="button"
                className="pr-btn primary"
                onClick={startAttempt}
                disabled={!target || loadingChallenge}
              >
                <Play size={16} /> Iniciar reto
              </button>
            ) : (
              <button
                type="button"
                className="pr-btn danger"
                onClick={finishAttempt}
                disabled={saving}
              >
                {saving ? <Loader2 size={16} className="spin" /> : <Square size={16} />}
                {saving ? "Evaluando..." : "Terminar y evaluar"}
              </button>
            )}
          </div>

          {mode === "letter" && (
            <div className="pr-alphabet" aria-label="Elige la letra que quieres aprender">
              <span>Elige la letra que quieres aprender</span>
              {ALPHABET.map((letter) => (
                <button
                  type="button"
                  key={letter}
                  className={`${target === letter ? "active" : ""} ${readyLetters.has(letter) ? "ready" : ""}`}
                  onClick={() => chooseLetter(letter)}
                  disabled={active}
                  title={readyLetters.has(letter) ? "Tu modelo personal ya aprendió esta letra" : undefined}
                >
                  {letter}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="pr-card pr-camera">
          <div className="pr-card-head">
            <span className="pr-eyebrow">
              <Camera size={14} /> {cameraStatus}
            </span>
            <span className={`pr-live-badge ${active ? "on" : ""}`}>
              {active ? "Reto activo" : "Lista"}
            </span>
          </div>

          <div className="pr-camera-controls">
            <select
              value={selectedCamera}
              onChange={(event) => changeCamera(event.target.value)}
              disabled={active}
              aria-label="Cámara"
            >
              {cameras.map((camera, index) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `Cámara ${index + 1}`}
                </option>
              ))}
            </select>
            <span className="pr-engine">
              {recognitionEngine === "word" ? "Manos + pose" : "MLP + LSTM"}
            </span>
          </div>

          <div className="translator-camera pr-video">
            <video ref={videoRef} autoPlay playsInline muted />
            <canvas ref={canvasRef} width={640} height={480} />

            <div className="pr-overlay">
              <div>
                <small>{recognitionEngine === "word" ? "Palabra" : "Seña"}</small>
                <strong>{currentLetter}</strong>
              </div>
              <div>
                <small>Confianza</small>
                <strong>{(confidence * 100).toFixed(0)}%</strong>
              </div>
              {personalized && <em>Ajustado por tu modelo</em>}
            </div>
          </div>

          <div className="pr-recognized">
            <small>Reconocido</small>
            <strong>{recognizedText || (currentLetter !== "-" ? currentLetter : "—")}</strong>
          </div>
        </section>
      </div>

      {error && <div className="language-event-message error">{error}</div>}

      {result && (
        <section className={`pr-card pr-result ${result.attempt.success ? "success" : "retry"}`}>
          <div className="pr-result-title">
            {result.attempt.success ? <CheckCircle2 size={22} /> : <RotateCcw size={22} />}
            <div>
              <strong>{result.attempt.success ? "¡Reto completado!" : "Sigue practicando"}</strong>
              <small>
                Objetivo <b>{result.attempt.target_text}</b> · Reconocido{" "}
                <b>{result.attempt.recognized_text || "—"}</b>
              </small>
            </div>
            {result.badge && <span className="pr-badge">{result.badge}</span>}
          </div>

          <div className="pr-result-metrics">
            <div><small>Precisión</small><strong>{result.attempt.accuracy.toFixed(1)}%</strong></div>
            <div><small>Tiempo</small><strong>{formatDuration(result.attempt.duration_ms)}</strong></div>
            <div><small>XP</small><strong>+{result.attempt.xp_earned}</strong></div>
            <div><small>Racha</small><strong>{result.progress.current_streak}</strong></div>
          </div>

          {result.training && (
            <div className="pr-result-training">
              {result.training.saved > 0 ? (
                <span>
                  <BrainCircuit size={15} /> {result.training.saved} muestras guardadas
                  {result.training.verified || confirmed
                    ? " y añadidas a tu modelo personal."
                    : " como pendientes."}
                </span>
              ) : result.training.reason ? (
                <span>Muestras no guardadas: {result.training.reason}.</span>
              ) : null}
              {Boolean(result.training.language_feedback) && (
                <span>
                  El corrector aprendió {result.training.language_feedback} palabra(s).
                </span>
              )}
              {!result.attempt.success &&
                !confirmed &&
                result.training.saved > 0 &&
                result.attempt.mode === "letter" && (
                  <button
                    type="button"
                    className="pr-btn ghost small"
                    onClick={confirmSamples}
                    disabled={trainingBusy}
                  >
                    <Check size={15} /> Mi seña era correcta
                  </button>
                )}
            </div>
          )}
        </section>
      )}

      <div className="pr-bottom">
        <TrainingPanel
          stats={trainingStats}
          contribute={contribute}
          onContributeChange={setContribute}
          busy={trainingBusy}
          message={trainingMessage}
          onExport={exportDataset}
          onReset={resetSamples}
        />

        <section className="pr-card pr-history">
          <div className="pr-card-head">
            <span className="pr-eyebrow">
              <History size={14} /> Últimos intentos
            </span>
          </div>
          {recentAttempts.length ? (
            <ul>
              {recentAttempts.map((attempt) => (
                <li key={attempt.id}>
                  <span className={`pr-dot ${attempt.success ? "ok" : "ko"}`} />
                  <strong>{attempt.target_text}</strong>
                  <small>{attempt.accuracy.toFixed(0)}%</small>
                  <em>+{attempt.xp_earned} XP</em>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pr-empty">Completa tu primer reto para ver tu historial.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default Practice;
