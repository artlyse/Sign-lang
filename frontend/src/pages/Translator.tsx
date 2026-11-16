/**
 * Pantalla principal de traducción. Orquesta cámara, MediaPipe, WebSocket, modo Letras/Palabras, sugerencias, Qwen y TTS.
 */

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CaseSensitive,
  CircleAlert,
  Eraser,
  Info,
  Loader2,
  MessageSquareText,
  Mic,
  MicOff,
  SlidersHorizontal,
  Sparkles,
  SwitchCamera,
  Trash2,
  Undo2,
  UserCheck,
  UserRound,
  RotateCcw,
  Send,
  ScanFace,
  LayoutTemplate,
  Volume2,
  VolumeX,
  WholeWord,
} from "lucide-react";
import "../styles/translator-workspace.css";
import { captureFrame, getFaceStatus, verifyFace } from "../services/face";
import { listTemplates, suggestPhrases } from "../services/templates";
import type { Template } from "../services/templates";
import { API_URL, getUserProfile } from "../services/auth";
import { getActiveTemplateId, setActiveTemplateId } from "../services/preferences";
import {
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import useSpeechRecognition from "../hooks/useSpeechRecognition";
import useTextToSpeech from "../hooks/useTextToSpeech";
import {
  getAutoTtsEnabled,
  getAutoTtsMode,
  setAutoTtsEnabled,
  setAutoTtsMode,
} from "../services/preferences";
import type { AutoTtsMode } from "../services/preferences";
import {
  buildWordFrameFeatures,
  drawPoseLandmarks,
  POSE_MODEL_URL,
} from "../services/wordVision";

const WS_URL =
  import.meta.env.VITE_WS_URL ??
  `${API_URL.replace(/^http/, "ws")}/ws/recognition`;

const buildWsUrl = () => {
const token = window.localStorage.getItem("signlang_access_token");
if (!token) return WS_URL;
const separator = WS_URL.includes("?") ? "&" : "?";
return `${WS_URL}${separator}token=${encodeURIComponent(token)}`;
};

const MODEL_URL = "/hand_landmarker.task";

const RECOGNITION_FPS = 30;
const WORD_RECOGNITION_FPS = 15;
const SEND_INTERVAL_MS = 1000 / RECOGNITION_FPS;
const WORD_SEND_INTERVAL_MS = 1000 / WORD_RECOGNITION_FPS;

// Si J/Z no coinciden con la orientacion usada durante entrenamiento, prueba true.
const MIRROR_LANDMARK_X = false;

// Si la mano permanece fuera este tiempo, se cierra/corrige la palabra.
// Una ausencia mas corta solo desbloquea letras repetidas, por ejemplo LL.
const WORD_GAP_MS = 950;
// En modo Palabra no cerramos el gesto ante un único frame perdido.
const WORD_HAND_ABSENCE_MS = 280;

type RecognitionMode = "static" | "dynamic" | "word" | "none";
type RecognitionInputMode = "letter" | "word";

type Suggestion = {
  word: string;
  key: string;
  score: number;
  base_score?: number;
  ml_probability?: number | null;
  ml_weight?: number;
  distance: number;
  similarity: number;
  frequency: number;
  dictionary?: boolean;
  completion?: boolean;
};

type SentenceItem = {
  index: number;
  raw: string;
  word: string;
  suggestions: Suggestion[];
};

type PendingFeedback = {
  raw: string;
  predicted: string;
  context_words: string[];
  autocorrected: boolean;
  score: number;
  margin?: number;
  suggestions: string[];
};

type LearningStats = {
  memory?: {
    feedback_count?: number;
    learned_substitution_pairs?: number;
    learned_bigram_pairs?: number;
    learned_trigram_pairs?: number;
  };
  ranker?: {
    fitted?: boolean;
    trained_feedback?: number;
    positive_examples?: number;
    negative_examples?: number;
    effective_weight?: number;
  };
};

type LearningState = {
  pending_feedback: PendingFeedback | null;
  stats: LearningStats;
};

type LanguageEvent =
  | {
      type: string;
      [key: string]: unknown;
    }
  | null;

type LanguageState = {
  raw_word: string;
  resolved_word?: string;
  preview_word: string;
  autocorrect_active?: boolean;
  resolution_reason?: string;
  suggestions: Suggestion[];
  suggestion_scope?: "current" | "last_finalized" | "none";
  suggestion_source_word?: string;
  last_finalized_word?: string;
  sentence_words: string[];
  sentence_items?: SentenceItem[];
  sentence: string;
  display_text: string;
  event: LanguageEvent;
  learning?: LearningState;
  error?: string;
};

const EMPTY_LANGUAGE_STATE: LanguageState = {
  raw_word: "",
  resolved_word: "",
  preview_word: "",
  autocorrect_active: false,
  suggestions: [],
  suggestion_scope: "none",
  suggestion_source_word: "",
  last_finalized_word: "",
  sentence_words: [],
  sentence_items: [],
  sentence: "",
  display_text: "",
  event: null,
  learning: {
    pending_feedback: null,
    stats: {},
  },
};

function formatWordLabel(value: unknown) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type WordCandidate = {
  word: string;
  confidence: number;
};

type ChatMessage = {
  id: number;
  from: "user" | "staff";
  text: string;
  original?: string;
  time: string;
};

const QUESTION_WORDS: Record<string, string> = {
  como: "cómo",
  que: "qué",
  donde: "dónde",
  adonde: "adónde",
  cuanto: "cuánto",
  cuanta: "cuánta",
  cuantos: "cuántos",
  cuantas: "cuántas",
  cual: "cuál",
  cuales: "cuáles",
  quien: "quién",
  quienes: "quiénes",
  cuando: "cuándo",
};

// Verbos de pregunta sin palabra interrogativa: "¿puedes ayudarme?"
const QUESTION_VERBS = ["puedes", "puede", "tienes", "tiene", "hay", "sabes", "sabe", "quieres", "quiere"];

const GREETINGS = [
  ["buenos", "dias"],
  ["buenas", "tardes"],
  ["buenas", "noches"],
  ["hola"],
  ["gracias"],
];

const stripAccents = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Ordena una parte de la oración: tildes interrogativas, ¿?, punto final. */
function formatClause(tokens: string[]) {
  if (tokens.length === 0) return "";
  const plain = tokens.map(stripAccents);
  const qIndex = plain.findIndex((w) => w in QUESTION_WORDS);
  const isQuestion =
    (qIndex >= 0 && qIndex <= 1) || QUESTION_VERBS.includes(plain[0]);

  const words = tokens.map((word, i) => {
    if (!isQuestion) return word;
    if (i === qIndex) return QUESTION_WORDS[plain[i]];
    // "cómo estas" -> "cómo estás", "dónde esta" -> "dónde está"
    if (i === qIndex + 1 && plain[i] === "estas") return "estás";
    if (i === qIndex + 1 && plain[i] === "esta") return "está";
    return word;
  });

  const text = capitalize(words.join(" "));
  if (isQuestion) return `¿${text.replace(/[.!?]+$/, "")}?`;
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

/**
 * Convierte lo señado (MAYÚSCULAS, sin signos) en una oración legible:
 * "HOLA COMO ESTAS" -> "Hola, ¿cómo estás?". Las palabras que ya vienen con
 * mayúsculas y minúsculas (frases de plantilla o nombres) se respetan.
 */
function formatSentence(words: string[]) {
  const tokens = words
    .flatMap((word) => word.replace(/_/g, " ").split(/\s+/))
    .filter(Boolean)
    .map((word) =>
      word === word.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(word) ? word.toLowerCase() : word,
    );
  if (tokens.length === 0) return "";

  // Si ya tiene signos (frase de plantilla), solo se asegura la mayúscula inicial.
  if (tokens.some((t) => /[¿?¡!.,]/.test(t))) {
    const text = capitalize(tokens.join(" "));
    return /[.!?…]$/.test(text) ? text : `${text}.`;
  }

  const plain = tokens.map(stripAccents);
  const greeting = GREETINGS.find((g) => g.every((w, i) => plain[i] === w));
  if (greeting && tokens.length > greeting.length) {
    const head = capitalize(
      tokens
        .slice(0, greeting.length)
        .join(" ")
        .replace(/^buenos dias$/i, "buenos días"),
    );
    // "Hola, ¿cómo estás?": tras la coma la cláusula va en minúscula.
    return `${head}, ${formatClause(tokens.slice(greeting.length)).replace(/^(¿?)(\p{L})/u, (_m, q, c) =>
      q + c.toLowerCase(),
    )}`;
  }

  return formatClause(tokens);
}

const nowLabel = () =>
  new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

function Translator() {
  const {
    text: speechText,
    isListening,
    isSupported: speechSupported,
    error: speechError,
    startListening,
    stopListening,
    clearText: clearSpeechText,
  } = useSpeechRecognition();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTemplateId, setActiveTemplateIdState] = useState(() =>
    getActiveTemplateId(),
  );
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceMessage, setFaceMessage] =
    useState<{ type: "ok" | "error"; text: string } | null>(null);
  // Nombre usado en las frases {nombre}: el del rostro reconocido tiene prioridad.
  const [faceName, setFaceName] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const faceAttemptsRef = useRef(0);

  useEffect(() => {
    listTemplates("all")
      .then(setTemplates)
      .catch((error) => console.warn("No se pudieron cargar las plantillas:", error));

    getUserProfile()
      .then((profile) => setAccountName(profile.display_name || null))
      .catch(() => undefined);

    getFaceStatus()
      .then((face) => setFaceEnrolled(face.recognition_ready))
      .catch(() => setFaceEnrolled(false));
  }, []);

  const chooseTemplate = (id: string) => {
    setActiveTemplateIdState(id);
    setActiveTemplateId(id);
  };

  const {
    speak: speakTranslation,
    stop: stopTranslationSpeech,
    isSpeaking: translationSpeaking,
    supported: ttsSupported,
  } = useTextToSpeech();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationRef = useRef<number>(0);
  const lastSentAtRef = useRef<number>(0);
  const frameInFlightRef = useRef(false);
  const frameRequestIdRef = useRef(0);
  const frameTimeoutRef = useRef<number | null>(null);
  const hadHandRef = useRef(false);
  const wordHandAbsentSinceRef = useRef<number | null>(null);
  const wordGapTimerRef = useRef<number | null>(null);
  const recognitionInputModeRef = useRef<RecognitionInputMode>("letter");
  const autoTtsRef = useRef(getAutoTtsEnabled());
  const autoTtsModeRef = useRef<AutoTtsMode>(getAutoTtsMode());

  const [letter, setLetter] = useState("-");
  const [confidence, setConfidence] = useState(0);
  const [personalized, setPersonalized] = useState(false);
  const [recognitionMode, setRecognitionMode] =
    useState<RecognitionMode>("none");
  const [recognitionInputMode, setRecognitionInputMode] =
    useState<RecognitionInputMode>("letter");
  const [status, setStatus] = useState("Iniciando...");
  const [cameraState, setCameraState] =
    useState<"loading" | "live" | "error">("loading");
  const [connected, setConnected] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [cameraFacing, setCameraFacing] =
    useState<"user" | "environment">("user");
  const [language, setLanguage] = useState<LanguageState>(
    EMPTY_LANGUAGE_STATE,
  );
  const [manualCorrection, setManualCorrection] = useState("");
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [aiSentence, setAiSentence] = useState("");
  // Texto exacto que se envió a corregir: si la oración cambia, la corrección queda vieja.
  const [aiFor, setAiFor] = useState("");
  const aiForRef = useRef("");
  const aiTimeoutRef = useRef<number | undefined>(undefined);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);
  const [aiCorrecting, setAiCorrecting] = useState(false);
  const [aiCorrectionError, setAiCorrectionError] = useState("");
  const [autoTts, setAutoTts] = useState(() => getAutoTtsEnabled());
  const [autoTtsMode, setAutoTtsModeState] =
    useState<AutoTtsMode>(() => getAutoTtsMode());
  const [wordBuffer, setWordBuffer] = useState(0);
  const [wordGestureFrames, setWordGestureFrames] = useState(0);
  const [wordCandidates, setWordCandidates] = useState<WordCandidate[]>([]);
  const [showLandmarks] = useState(
    () => localStorage.getItem("show_landmarks") !== "false",
  );

  const selectedSentenceItem =
    selectedWordIndex !== null
      ? language.sentence_items?.[selectedWordIndex] ?? null
      : null;

  const sendCommand = (payload: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  };

  const clearFrameTimeout = () => {
    if (frameTimeoutRef.current !== null) {
      window.clearTimeout(frameTimeoutRef.current);
      frameTimeoutRef.current = null;
    }
  };

  const releaseFrame = () => {
    frameInFlightRef.current = false;
    clearFrameTimeout();
  };

  const cancelWordGapTimer = () => {
    if (wordGapTimerRef.current !== null) {
      window.clearTimeout(wordGapTimerRef.current);
      wordGapTimerRef.current = null;
    }
  };

  const scheduleWordFinalization = () => {
    cancelWordGapTimer();

    wordGapTimerRef.current = window.setTimeout(() => {
      sendCommand({ mode: "finalize_word" });
      wordGapTimerRef.current = null;
    }, WORD_GAP_MS);
  };

  useEffect(() => {
    recognitionInputModeRef.current = recognitionInputMode;
    setLetter("-");
    setConfidence(0);
    setRecognitionMode("none");
    setWordBuffer(0);
    setWordGestureFrames(0);
    setWordCandidates([]);
    wordHandAbsentSinceRef.current = null;
    setAiSentence("");
    setSelectedWordIndex(null);
    cancelWordGapTimer();
    sendCommand({ mode: "clear_language" });
    sendCommand({ mode: "reset" });
  // El cambio de modo debe limpiar el buffer del backend una sola vez.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recognitionInputMode]);

  useEffect(() => {
    autoTtsRef.current = autoTts;
    setAutoTtsEnabled(autoTts);
    if (!autoTts) stopTranslationSpeech();
  }, [autoTts, stopTranslationSpeech]);

  useEffect(() => {
    autoTtsModeRef.current = autoTtsMode;
    setAutoTtsMode(autoTtsMode);
  }, [autoTtsMode]);
const loadCameras = async () => {
  try {
    const devices =
      await navigator.mediaDevices.enumerateDevices();

    const videoDevices = devices.filter(
      (device) => device.kind === "videoinput"
    );

    setCameras(videoDevices);

    return videoDevices;
  } catch (error) {
    console.error("Error detectando cámaras:", error);
    return [];
  }
};
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

      if (video.readyState === 4) {
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const now = performance.now();
          const handResult = handLandmarker.detectForVideo(video, now);
          const hasHands = Boolean(handResult.landmarks?.length);

          if (hasHands) {
            cancelWordGapTimer();
            wordHandAbsentSinceRef.current = null;
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
                (recognitionInputModeRef.current === "word"
                  ? WORD_SEND_INTERVAL_MS
                  : SEND_INTERVAL_MS) &&
              wsRef.current?.readyState === WebSocket.OPEN &&
              !frameInFlightRef.current
            ) {
              lastSentAtRef.current = now;
              frameInFlightRef.current = true;
              frameRequestIdRef.current += 1;
              const requestId = frameRequestIdRef.current;

              if (recognitionInputModeRef.current === "word") {
                const poseLandmarker = poseLandmarkerRef.current;
                if (!poseLandmarker) {
                  releaseFrame();
                  setStatus("Cargando detector corporal...");
                } else {
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
                      request_id: requestId,
                      timestamp_ms: now,
                      features,
                    }),
                  );
                }
              } else {
                const firstHand = handResult.landmarks?.[0];
                if (!firstHand) {
                  releaseFrame();
                } else {
                  const landmarks = firstHand.flatMap((lm) => [
                    MIRROR_LANDMARK_X ? 1 - lm.x : lm.x,
                    lm.y,
                    lm.z,
                  ]);

                  wsRef.current.send(
                    JSON.stringify({
                      mode: "hybrid",
                      request_id: requestId,
                      timestamp_ms: now,
                      landmarks,
                    }),
                  );
                }
              }

              clearFrameTimeout();
              frameTimeoutRef.current = window.setTimeout(() => {
                frameInFlightRef.current = false;
                frameTimeoutRef.current = null;
              }, 700);
            }
          } else if (hadHandRef.current) {
            if (recognitionInputModeRef.current === "word") {
              if (wordHandAbsentSinceRef.current === null) {
                wordHandAbsentSinceRef.current = now;
              }

              if (
                now - wordHandAbsentSinceRef.current >=
                WORD_HAND_ABSENCE_MS
              ) {
                hadHandRef.current = false;
                wordHandAbsentSinceRef.current = null;
                lastSentAtRef.current = 0;
                releaseFrame();
                setStatus("Evaluando gesto...");
                sendCommand({ mode: "hand_absent" });
              }
            } else {
              hadHandRef.current = false;
              wordHandAbsentSinceRef.current = null;
              lastSentAtRef.current = 0;
              releaseFrame();
              sendCommand({ mode: "hand_absent" });
              scheduleWordFinalization();
            }
          }
        }
      }

      animationRef.current = requestAnimationFrame(detectLoop);
    };



const initialize = async () => {
  try {
    // =====================================
    // 1. CONEXIÓN CON EL BACKEND
    // =====================================
    const ws = new WebSocket(buildWsUrl());

    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) return;

      releaseFrame();
      setConnected(true);
      setStatus("Backend conectado");

      ws.send(
        JSON.stringify({ mode: "get_language_state" })
      );
    };

    ws.onclose = () => {
      if (cancelled) return;

      releaseFrame();
      setConnected(false);
      setStatus("Backend desconectado");
    };

    ws.onerror = () => {
      if (cancelled) return;

      releaseFrame();
      setConnected(false);
      setStatus("Error de conexión con backend");
    };

    ws.onmessage = (event) => {
      if (cancelled) return;

      try {
        const data = JSON.parse(event.data);

        if (
          data.kind === "recognition" ||
          data.kind === "word_recognition" ||
          data.letter !== undefined
        ) {
          releaseFrame();
        }

        if (typeof data.letter === "string") {
          setLetter(data.letter || "-");
          setConfidence(Number(data.confidence ?? 0));
          setPersonalized(Boolean(data.personalized?.changed));

          setRecognitionMode(
            data.mode === "dynamic"
              ? "dynamic"
              : data.mode === "static"
                ? "static"
                : "none"
          );
        }

        if (data.kind === "word_recognition") {
          const buffer = Number(data.buffer ?? 0);
          const gestureFrames = Number(
            data.gesture_frames ?? buffer,
          );
          setWordBuffer(
            Number.isFinite(buffer) ? Math.max(0, buffer) : 0,
          );
          setWordGestureFrames(
            Number.isFinite(gestureFrames)
              ? Math.max(0, gestureFrames)
              : 0,
          );

          if (Array.isArray(data.top3)) {
            setWordCandidates(
              data.top3
                .map((item: { word?: unknown; confidence?: unknown }) => ({
                  word: formatWordLabel(item.word),
                  confidence: Number(item.confidence ?? 0),
                }))
                .filter(
                  (item: WordCandidate) =>
                    item.word && Number.isFinite(item.confidence),
                )
                .slice(0, 3),
            );
          }

          const nextWord = formatWordLabel(data.word);
          const nextConfidence = Number(data.confidence ?? 0);

          // Las respuestas de buffering ya no borran la última inferencia
          // válida con "-" o 0%.
          if (
            nextWord &&
            nextWord !== "-" &&
            Number.isFinite(nextConfidence) &&
            nextConfidence > 0
          ) {
            setLetter(nextWord);
            setConfidence(nextConfidence);
            setRecognitionMode("word");
          }

          if (data.error) {
            setStatus(String(data.error));
          } else if (data.accepted) {
            setStatus(`Palabra reconocida: ${nextWord}`);
          } else if (
            data.source === "gesture_end" &&
            data.reason === "low_confidence"
          ) {
            setStatus(
              `Gesto detectado con confianza insuficiente: ${(
                nextConfidence * 100
              ).toFixed(1)}%`,
            );
          }
        }

        if (data.language) {
          const nextLanguage = data.language as LanguageState;
          setLanguage(nextLanguage);

          const eventType = nextLanguage.event?.type;
          if (
            autoTtsRef.current &&
            (eventType === "word_finalized" ||
              eventType === "word_sign_added")
          ) {
            const completedWord = String(
              nextLanguage.event?.word ?? "",
            ).trim();

            if (autoTtsModeRef.current === "continuous") {
              const fullMessage = String(
                nextLanguage.display_text ||
                  nextLanguage.sentence ||
                  "",
              ).trim();
              if (fullMessage) {
                // SpeechSynthesis.cancel() dentro del hook reinicia la lectura
                // desde el principio con la oración actualizada.
                speakTranslation(fullMessage, "es-PE");
              }
            }
            // En modo "Al enviar" no se lee cada palabra: se lee el mensaje final.
            void completedWord;
          }
        }

        if (data.kind === "sentence_correction") {
          window.clearTimeout(aiTimeoutRef.current);
          setAiCorrecting(false);

          const correction = data.sentence_correction;

          if (correction?.corrected) {
            const correctedText = String(correction.corrected);
            setAiSentence(correctedText);
            setAiFor(aiForRef.current);
            setAiCorrectionError("");
          } else {
            setAiCorrectionError(
              "No se pudo generar una corrección contextual."
            );
          }
        }

        if (data.error) {
          setAiCorrecting(false);

          const errorMessage = String(data.error);

          if (
            errorMessage.toLowerCase().includes("modelo contextual") ||
            errorMessage.toLowerCase().includes("torch") ||
            errorMessage.toLowerCase().includes("transform")
          ) {
            setAiCorrectionError(errorMessage);
          }

          releaseFrame();
          console.warn("Backend:", errorMessage);
          setStatus(`Backend: ${errorMessage}`);
        }
      } catch (error) {
        console.error(
          "Respuesta WebSocket inválida:",
          error
        );
      }
    };

    // =====================================
    // 2. CARGAR MEDIAPIPE
    // =====================================
    setStatus("Cargando detector...");
    console.log("PASO 1: Cargando MediaPipe");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
    );

    if (cancelled) return;

    console.log(
      "PASO 2: MediaPipe cargado correctamente"
    );

    // =====================================
    // 3. CREAR HANDLANDMARKER
    // =====================================
    const landmarker =
      await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });

    if (cancelled) {
      landmarker.close();
      return;
    }

    landmarkerRef.current = landmarker;

    const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: POSE_MODEL_URL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });

    if (cancelled) {
      landmarker.close();
      poseLandmarker.close();
      return;
    }

    poseLandmarkerRef.current = poseLandmarker;

    console.log(
      "PASO 3: HandLandmarker + PoseLandmarker creados correctamente"
    );

    // =====================================
    // 4. SOLICITAR ACCESO A LA CÁMARA
    // =====================================
    setStatus("Abriendo cámara...");
    console.log("PASO 4: Solicitando acceso a cámara");

    const newStream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: {
            ideal: cameraFacing,
          },
        },
        audio: false,
      });

    stream = newStream;

    if (cancelled) {
      newStream.getTracks().forEach(
        (track) => track.stop()
      );
      return;
    }

    streamRef.current = newStream;

    // =====================================
    // 5. IDENTIFICAR CÁMARA ACTIVA
    // =====================================
    const videoTrack = newStream.getVideoTracks()[0];

    if (videoTrack) {
      const settings = videoTrack.getSettings();

      if (settings.deviceId) {
        setSelectedCamera(settings.deviceId);
      }

      if (settings.facingMode === "environment") {
        setCameraFacing("environment");
      } else if (settings.facingMode === "user") {
        setCameraFacing("user");
      }
    }

    await loadCameras();

    if (cancelled) return;

    // =====================================
    // 6. MOSTRAR VIDEO EN PANTALLA
    // =====================================
    const video = videoRef.current;

    if (!video) {
      throw new Error("No se encontró el elemento de video");
    }

    video.srcObject = newStream;

    if (cancelled) return;

    if (video.srcObject !== newStream) {
      video.srcObject = newStream;
    }

    try {
      await video.play();
    } catch (error) {
      if (cancelled) return;

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        console.warn(
          "La reproducción fue interrumpida por otro cambio de cámara."
        );
        return;
      }

      throw error;
    }

    if (cancelled) return;

    // =====================================
    // 7. INICIAR RECONOCIMIENTO
    // =====================================
    console.log("PASO 5: Cámara funcionando");

    setStatus("Cámara activa");
    setCameraState("live");
    detectLoop();

  } catch (error) {
    if (cancelled) return;

    console.error(
      "ERROR AL INICIAR TRADUCTOR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    setStatus(`Error: ${message}`);
    setCameraState("error");
  }
};


    initialize();

    return () => {
      cancelAnimationFrame(animationRef.current);
      cancelWordGapTimer();
      clearFrameTimeout();
      frameInFlightRef.current = false;
      wsRef.current?.close();
      landmarkerRef.current?.close();
      poseLandmarkerRef.current?.close();

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);
  const changeCamera = async (
  deviceId?: string,
  facingMode?: "user" | "environment"
) => {
  try {
    setStatus("Cambiando cámara...");

    streamRef.current?.getTracks().forEach(
      (track) => track.stop()
    );

    const videoConstraints: MediaTrackConstraints =
      deviceId
        ? {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : {
            facingMode: {
              ideal: facingMode ?? "user",
            },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          };

    const newStream =
      await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

    streamRef.current = newStream;

    if (videoRef.current) {
      videoRef.current.srcObject = newStream;
      await videoRef.current.play();
    }

    const track = newStream.getVideoTracks()[0];

    if (track) {
      const settings = track.getSettings();

      if (settings.deviceId) {
        setSelectedCamera(settings.deviceId);
      }

      if (settings.facingMode === "environment") {
        setCameraFacing("environment");
      } else if (settings.facingMode === "user") {
        setCameraFacing("user");
      }
    }

    await loadCameras();

    setStatus("Cámara activa");
    setCameraState("live");
  } catch (error) {
    console.error("Error cambiando cámara:", error);
    setStatus("No se pudo cambiar la cámara");
    setCameraState("error");
  }
};

  const finalizarPalabra = () => {
    cancelWordGapTimer();
    sendCommand({ mode: "finalize_word" });
  };

  const elegirSugerencia = (word: string) => {
    cancelWordGapTimer();
    setAiSentence("");
    setAiCorrectionError("");
    sendCommand({
      mode: "choose_suggestion",
      word,
    });
  };

  const elegirSugerenciaDePalabra = (word: string) => {
    if (selectedWordIndex === null) return;

    setAiSentence("");
    setAiCorrectionError("");

    sendCommand({
      mode: "replace_sentence_word",
      index: selectedWordIndex,
      word,
    });
  };

  const corregirOracionIA = () => {
    const sentence = language.display_text.trim();

    if (!sentence && !language.raw_word) return;

    setAiCorrecting(true);
    setAiCorrectionError("");
    aiForRef.current = sentence;

    // Si la IA tarda (p. ej. cargando el modelo la primera vez), se avisa y se
    // libera el botón; el mensaje ordenado automáticamente sigue disponible.
    window.clearTimeout(aiTimeoutRef.current);
    aiTimeoutRef.current = window.setTimeout(() => {
      setAiCorrecting((busy) => {
        if (busy) {
          setAiCorrectionError(
            "La IA está tardando (puede estar cargando el modelo). Puedes enviar el mensaje así o intentar de nuevo en un momento.",
          );
        }
        return false;
      });
    }, 25000);

    sendCommand({
      mode: "correct_sentence",
      sentence,
    });
  };

  const borrarUltimo = () => {
    cancelWordGapTimer();
    setAiSentence("");
    setSelectedWordIndex(null);
    sendCommand({ mode: "backspace_language" });
  };

  const limpiar = () => {
    cancelWordGapTimer();
    setManualCorrection("");
    setAiSentence("");
    setAiFor("");
    setAiCorrectionError("");
    setSelectedWordIndex(null);
    sendCommand({ mode: "clear_language" });
  };


  const corregirYAprender = () => {
    const word = manualCorrection.trim();
    if (!word) return;

    sendCommand({
      mode: "correct_last_word",
      word,
    });
    setManualCorrection("");
  };


  const currentWord =
    language.resolved_word || language.preview_word || language.raw_word || "";

  // Reconoce a la persona con su rostro registrado. El nombre obtenido se usa
  // en las frases de la plantilla ({nombre}). `silent` evita avisos de error
  // en los intentos automáticos.
  const presentarme = async (silent = false) => {
    if (!videoRef.current) return false;
    setFaceBusy(true);
    if (!silent) setFaceMessage(null);
    try {
      const frame = await captureFrame(videoRef.current);
      const result = await verifyFace(frame);
      if (result.verified && result.display_name) {
        setFaceName(result.display_name);
        setFaceMessage({
          type: "ok",
          text: `Hola, ${result.display_name}. Tus frases ya usan tu nombre.`,
        });
        window.setTimeout(() => setFaceMessage(null), 5000);
        return true;
      }
      if (!silent) {
        setFaceMessage({ type: "error", text: result.message });
        window.setTimeout(() => setFaceMessage(null), 5000);
      }
    } catch (error) {
      if (!silent) {
        setFaceMessage({
          type: "error",
          text: error instanceof Error ? error.message : "No se pudo verificar el rostro.",
        });
        window.setTimeout(() => setFaceMessage(null), 5000);
      }
    } finally {
      setFaceBusy(false);
    }
    return false;
  };

  // Reconocimiento automático: con la cámara activa y un rostro registrado,
  // se intenta identificar a la persona (hasta 4 intentos, cada 4 s).
  useEffect(() => {
    if (cameraState !== "live" || !faceEnrolled || faceName) return;
    if (faceAttemptsRef.current >= 4) return;

    const timer = window.setTimeout(async () => {
      faceAttemptsRef.current += 1;
      const ok = await presentarme(true);
      if (!ok && faceAttemptsRef.current < 4) {
        // fuerza un nuevo intento cambiando el estado del efecto
        setFaceBusy(false);
      }
    }, faceAttemptsRef.current === 0 ? 1500 : 4000);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraState, faceEnrolled, faceName, faceBusy]);

  const personName = faceName || accountName;

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [thread.length]);

  // Al terminar de hablar, la respuesta del personal pasa al chat.
  const wasListeningRef = useRef(false);
  useEffect(() => {
    if (wasListeningRef.current && !isListening && speechText.trim()) {
      setThread((list) => [
        ...list,
        { id: Date.now(), from: "staff", text: speechText.trim(), time: nowLabel() },
      ]);
      clearSpeechText();
    }
    wasListeningRef.current = isListening;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  // Plantilla activa ("all" = todas las visibles para la cuenta).
  const activeTemplates =
    activeTemplateId === "all"
      ? templates
      : templates.filter((t) => t.id === activeTemplateId);
  const activeTemplate =
    activeTemplateId === "all" ? null : activeTemplates[0] ?? null;

  // Lo señado hasta ahora: palabras cerradas + letras de la palabra en curso.
  const signedSoFar = [...language.sentence_words, language.raw_word]
    .filter(Boolean)
    .join(" ");
  const phraseSuggestions = suggestPhrases(
    signedSoFar,
    activeTemplates.length > 0 ? activeTemplates : templates,
    personName,
  );

  // Mensaje final: lo que la persona quiso decir.
  // 1) corrección con IA si corresponde al texto actual, 2) frase de plantilla
  //    tal cual, 3) lo señado ordenado automáticamente.
  const signedWords = [
    ...language.sentence_words,
    ...(currentWord ? [currentWord] : []),
  ];
  const signedText = language.display_text.trim();
  const fromTemplate = language.sentence_words.some((w) => w !== w.toUpperCase());
  const finalMessage: { text: string; source: "ia" | "plantilla" | "auto" } =
    aiSentence && aiFor && aiFor === signedText
      ? { text: aiSentence, source: "ia" }
      : { text: formatSentence(signedWords), source: fromTemplate ? "plantilla" : "auto" };

  const enviarMensaje = () => {
    if (!finalMessage.text) return;
    setThread((list) => [
      ...list,
      {
        id: Date.now(),
        from: "user",
        text: finalMessage.text,
        original: signedWords.join(" "),
        time: nowLabel(),
      },
    ]);
    if (autoTts) speakTranslation(finalMessage.text, "es-PE");
    limpiar();
  };

  const usarFrase = (text: string, replace: boolean) => {
    sendCommand({
      mode: "insert_text",
      text,
      source: "template",
      keep_case: true,
      replace,
    });
  };

  const modeLabel =
    recognitionMode === "word"
      ? "Palabra completa"
      : recognitionMode === "dynamic"
        ? "Dinámica"
        : recognitionMode === "static"
          ? "Estática"
          : "";

  const hasSentence =
    Boolean(language.raw_word) || language.sentence_words.length > 0;

  const suggestionSource = selectedSentenceItem
    ? selectedSentenceItem.suggestions
    : language.suggestions;

  return (
    <div className="page translator-page tw">
      {/* ============ COLUMNA PRINCIPAL: CÁMARA ============ */}
      <section className="tw-main">
        <div className="tw-toolbar">
          <div className="tw-segmented" role="group" aria-label="Modo de reconocimiento">
            <button
              type="button"
              className={recognitionInputMode === "letter" ? "active" : ""}
              onClick={() => setRecognitionInputMode("letter")}
            >
              <CaseSensitive size={16} /> Letras
            </button>
            <button
              type="button"
              className={recognitionInputMode === "word" ? "active" : ""}
              onClick={() => setRecognitionInputMode("word")}
            >
              <WholeWord size={16} /> Palabras
            </button>
          </div>

          <label className="tw-camera-select" htmlFor="camera-select">
            <Camera size={16} />
            <select
              id="camera-select"
              aria-label="Cámara"
              value={selectedCamera}
              onChange={(event) => changeCamera(event.target.value)}
            >
              {cameras.length === 0 && <option value="">Sin cámaras</option>}
              {cameras.map((camera, index) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `Cámara ${index + 1}`}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="tw-icon-button"
            onClick={() =>
              changeCamera(
                undefined,
                cameraFacing === "user" ? "environment" : "user",
              )
            }
            title={
              cameraFacing === "user"
                ? "Cambiar a cámara trasera"
                : "Cambiar a cámara frontal"
            }
          >
            <SwitchCamera size={17} />
            <span>{cameraFacing === "user" ? "Frontal" : "Trasera"}</span>
          </button>

          <button
            type="button"
            className="tw-icon-button"
            onClick={() => presentarme()}
            disabled={faceBusy || cameraState !== "live"}
            title={
              faceName
                ? `Reconocido por rostro: ${faceName}. Pulsa para volver a verificar.`
                : "Reconoce tu rostro registrado para usar tu nombre en las frases"
            }
          >
            {faceBusy ? <Loader2 size={17} className="tw-spin" /> : <UserCheck size={17} />}
            <span>{faceName ? faceName : "Presentarme"}</span>
          </button>

          <div
            className={`tw-pill ${connected ? "ok" : "off"}`}
            title={connected ? "Backend conectado" : "Backend desconectado"}
          >
            <span />
            {connected ? "Conectado" : "Sin conexión"}
          </div>
        </div>

        <div className="tw-stage">
          <div className="translator-camera tw-camera">
            <video ref={videoRef} autoPlay playsInline muted />
            <canvas ref={canvasRef} width={640} height={480} />

            <div className={`tw-live ${cameraState}`} title={status}>
              {cameraState === "live" ? (
                <>
                  <span className="tw-live-dot" /> EN VIVO
                </>
              ) : cameraState === "error" ? (
                <>
                  <CircleAlert size={14} /> {status}
                </>
              ) : (
                <>
                  <Loader2 size={14} className="tw-spin" /> {status}
                </>
              )}
            </div>

            {faceMessage && (
              <div className={`tw-face-toast ${faceMessage.type}`}>{faceMessage.text}</div>
            )}

            {cameraState === "live" && status !== "Cámara activa" && (
              <div className="tw-status-chip">{status}</div>
            )}

            <div className="tw-result">
              <div className="tw-result-sign">
                <small>
                  {recognitionInputMode === "word" ? "Palabra" : "Seña"}
                  {modeLabel ? ` · ${modeLabel}` : ""}
                </small>
                <strong className={recognitionInputMode === "word" ? "word" : ""}>
                  {letter}
                </strong>
              </div>
              <div className="tw-result-conf">
                <div>
                  <small>Confianza</small>
                  <b>{(confidence * 100).toFixed(0)}%</b>
                </div>
                <div className="tw-bar">
                  <i style={{ width: `${Math.min(confidence * 100, 100)}%` }} />
                </div>
                {personalized && recognitionInputMode !== "word" && (
                  <small className="tw-personal">Ajustado por tu modelo personal</small>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="tw-wordbar">
          <div className="tw-current">
            <small>Palabra en curso</small>
            <strong>{currentWord || "—"}</strong>
          </div>

          {recognitionInputMode === "word" && (
            <div className="tw-sequence">
              <small>
                Secuencia {Math.min(wordBuffer, 30)}/30 · {wordGestureFrames} frames
              </small>
              <div className="tw-bar">
                <i style={{ width: `${(Math.min(wordBuffer, 30) / 30) * 100}%` }} />
              </div>
              {wordCandidates.length > 0 && (
                <div className="tw-candidates">
                  {wordCandidates.map((candidate) => (
                    <span key={`${candidate.word}-${candidate.confidence}`}>
                      {candidate.word} {(candidate.confidence * 100).toFixed(0)}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {recognitionInputMode === "letter" && (
            <button
              type="button"
              className="tw-primary"
              onClick={finalizarPalabra}
              disabled={!language.raw_word}
            >
              Finalizar palabra
            </button>
          )}

          <span
            className="tw-hint"
            title={
              recognitionInputMode === "letter"
                ? `Modo Letras: retira la mano brevemente para repetir una letra; una pausa cercana a ${WORD_GAP_MS} ms finaliza y corrige la palabra.`
                : "Modo Palabras: analiza dos manos y la pose de brazos/torso; cada gesto completo se agrega como una palabra cuando alcanza la confianza mínima."
            }
          >
            <Info size={16} />
          </span>
        </div>
      </section>

      {/* ============ COLUMNA DERECHA: CONVERSACIÓN ============ */}
      <aside className="tw-side">
        <section className="tw-card tw-conversation">
          <header className="tw-card-head">
            <div>
              <h3>
                <MessageSquareText size={17} /> Conversación
              </h3>
              <p>
                {thread.length > 0
                  ? `${thread.length} ${thread.length === 1 ? "mensaje" : "mensajes"}`
                  : "Los mensajes enviados aparecerán aquí"}
              </p>
            </div>
            <div className="tw-head-actions">
              {thread.length > 0 && (
                <button
                  type="button"
                  className="tw-icon-button"
                  onClick={() => setThread([])}
                  title="Empezar una conversación nueva"
                >
                  <RotateCcw size={15} />
                </button>
              )}
              <button
                type="button"
                className={`tw-icon-button ${autoTts ? "active" : ""}`}
                onClick={() => setAutoTts((value) => !value)}
                disabled={!ttsSupported}
                title="Leer en voz alta los mensajes"
              >
                {autoTts ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span>{translationSpeaking ? "Hablando…" : autoTts ? "Voz" : "Sin voz"}</span>
              </button>
            </div>
          </header>

          {/* -------- Historial: lo que se dijo de verdad -------- */}
          <div className="tw-thread" ref={threadRef}>
            {thread.length === 0 ? (
              <div className="tw-thread-empty">
                Señas → revisa el mensaje final abajo → <strong>Enviar</strong>.
                <br />
                Las respuestas del personal también se agregan aquí.
              </div>
            ) : (
              thread.map((item) => (
                <div key={item.id} className={`tw-bubble ${item.from}`}>
                  <small>
                    {item.from === "user" ? personName || "Persona" : "Personal"} ·{" "}
                    {item.time}
                  </small>
                  <p>{item.text}</p>
                  {item.from === "user" && item.original && item.original !== item.text && (
                    <em title="Lo que se reconoció de las señas">Señado: {item.original}</em>
                  )}
                  {ttsSupported && (
                    <button
                      type="button"
                      className="tw-bubble-speak"
                      onClick={() => speakTranslation(item.text, "es-PE")}
                      aria-label="Leer en voz alta"
                      title="Leer en voz alta"
                    >
                      <Volume2 size={13} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* -------- Mensaje final que se está componiendo -------- */}
          <div className="tw-composer">
            <div className="tw-final">
              <span className="tw-label">
                Lo que quieres decir
                {finalMessage.text && (
                  <i className={`tw-source ${finalMessage.source}`}>
                    {finalMessage.source === "ia"
                      ? "Corregido con IA"
                      : finalMessage.source === "plantilla"
                        ? "Plantilla"
                        : "Ordenado automáticamente"}
                  </i>
                )}
              </span>
              <p className={finalMessage.text ? "" : "empty"}>
                {finalMessage.text || "Empieza a señar o elige una frase de tu plantilla…"}
              </p>

              {(language.sentence_words.length > 0 || currentWord) && (
                <div className="tw-signed">
                  <small>Señado:</small>
                  {language.sentence_words.map((word, index) => (
                    <button
                      key={`${index}-${word}`}
                      type="button"
                      className={selectedWordIndex === index ? "active" : ""}
                      onClick={() =>
                        setSelectedWordIndex(selectedWordIndex === index ? null : index)
                      }
                      title="Ver otras opciones para esta palabra"
                    >
                      {word}
                    </button>
                  ))}
                  {currentWord && <span className="tw-signed-current">{currentWord}…</span>}
                </div>
              )}
            </div>

            {/* Alternativas para una palabra elegida, o para la que se deletrea */}
            {(selectedSentenceItem || language.suggestions.length > 0) && (
              <div className="tw-chips tw-mini">
                <span className="tw-mini-label">
                  {selectedSentenceItem ? `¿Quisiste decir…? (${selectedSentenceItem.word})` : "Palabra:"}
                </span>
                {suggestionSource.length > 0 ? (
                  suggestionSource.slice(0, 5).map((suggestion) => (
                    <button
                      type="button"
                      key={`${selectedSentenceItem?.index ?? "cur"}-${suggestion.word}-${suggestion.score}`}
                      onClick={() =>
                        selectedSentenceItem
                          ? elegirSugerenciaDePalabra(suggestion.word)
                          : elegirSugerencia(suggestion.word)
                      }
                      title={`Puntaje ${(suggestion.score * 100).toFixed(0)}%`}
                    >
                      {suggestion.word}
                    </button>
                  ))
                ) : (
                  <span className="tw-muted">Sin alternativas.</span>
                )}
              </div>
            )}

            {/* Frases de la plantilla activa */}
            <div className="tw-template-bar">
              <label className="tw-template-select" title="Plantilla de frases activa">
                <LayoutTemplate size={15} />
                <select
                  value={activeTemplate ? activeTemplateId : "all"}
                  onChange={(event) => chooseTemplate(event.target.value)}
                  aria-label="Plantilla activa"
                >
                  <option value="all">Todas las plantillas</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                      {template.owner === "Mi cuenta" ? " (mía)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <span
                className={`tw-person ${faceName ? "face" : ""}`}
                title={
                  faceName
                    ? "Nombre obtenido del reconocimiento facial"
                    : "Nombre de la cuenta (pulsa Presentarme para usar tu rostro)"
                }
              >
                {faceName ? <ScanFace size={14} /> : <UserRound size={14} />}
                {personName || "Sin nombre"}
              </span>
            </div>

            {phraseSuggestions.length > 0 && (
              <div className="tw-phrases">
                {phraseSuggestions.slice(0, 3).map((item) => (
                  <button
                    type="button"
                    key={`${item.pack}-${item.text}`}
                    className={item.personalized ? "personal" : ""}
                    onClick={() => usarFrase(item.text, item.replace)}
                    title={`${item.pack} · ${item.replace ? "reemplaza lo señado" : "se agrega al mensaje"}`}
                  >
                    <span>{item.text}</span>
                    <small>{item.pack}</small>
                  </button>
                ))}
              </div>
            )}

            {/* Corrección manual: solo cuando el corrector cambió la palabra */}
            {language.learning?.pending_feedback &&
              language.learning.pending_feedback.raw !==
                language.learning.pending_feedback.predicted && (
                <div className="tw-feedback">
                  <div className="tw-feedback-row">
                    <span>
                      <small>Reconocido</small>
                      <b>{language.learning.pending_feedback.raw}</b>
                    </span>
                    <span className="tw-arrow">→</span>
                    <span>
                      <small>Interpretado</small>
                      <b>{language.learning.pending_feedback.predicted}</b>
                    </span>
                  </div>
                  <div className="tw-feedback-input">
                    <input
                      type="text"
                      value={manualCorrection}
                      onChange={(event) => setManualCorrection(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") corregirYAprender();
                      }}
                      placeholder="¿Está mal? Escribe la palabra correcta"
                      maxLength={30}
                    />
                    <button
                      type="button"
                      onClick={corregirYAprender}
                      disabled={!manualCorrection.trim()}
                    >
                      Corregir
                    </button>
                  </div>
                </div>
              )}

            {aiCorrectionError && <div className="tw-msg error">{aiCorrectionError}</div>}
            {language.error && <div className="tw-msg error">{language.error}</div>}

            <details className="tw-details">
              <summary>
                <SlidersHorizontal size={14} /> Más opciones
              </summary>
              {autoTts && (
                <div className="tw-inline tw-details-row">
                  <span className="tw-label">Lectura</span>
                  <div className="tw-segmented small">
                    <button
                      type="button"
                      className={autoTtsMode === "new_words" ? "active" : ""}
                      onClick={() => setAutoTtsModeState("new_words")}
                    >
                      Al enviar
                    </button>
                    <button
                      type="button"
                      className={autoTtsMode === "continuous" ? "active" : ""}
                      onClick={() => setAutoTtsModeState("continuous")}
                    >
                      Mientras señas
                    </button>
                  </div>
                </div>
              )}
              <div className="tw-details-grid">
                <span>Captura original: <b>{language.raw_word || "-"}</b></span>
                <span>Correcciones aprendidas: <b>{language.learning?.stats?.memory?.feedback_count ?? 0}</b></span>
                <span>Confusiones: <b>{language.learning?.stats?.memory?.learned_substitution_pairs ?? 0}</b></span>
                <span>Peso ML: <b>{(((language.learning?.stats?.ranker?.effective_weight ?? 0) * 100)).toFixed(0)}%</b></span>
              </div>
            </details>
          </div>

          <footer className="tw-actions">
            <button
              type="button"
              className="tw-primary"
              onClick={enviarMensaje}
              disabled={!finalMessage.text}
              title="Agregar el mensaje final a la conversación"
            >
              <Send size={15} /> Enviar
            </button>
            <button
              type="button"
              onClick={corregirOracionIA}
              disabled={aiCorrecting || (!language.display_text.trim() && !language.raw_word)}
              title="Mejorar el mensaje con IA (tildes, puntuación y contexto)"
            >
              {aiCorrecting ? <Loader2 size={15} className="tw-spin" /> : <Sparkles size={15} />}
              IA
            </button>
            <button type="button" onClick={borrarUltimo} disabled={!hasSentence} title="Borrar la última palabra">
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              className="tw-danger"
              onClick={limpiar}
              disabled={!hasSentence}
              title="Descartar el mensaje"
            >
              <Trash2 size={15} />
            </button>
          </footer>
        </section>

        <section className="tw-card tw-response">
          <header className="tw-card-head">
            <div>
              <h3>
                <Mic size={17} /> Respuesta del personal
              </h3>
              <p>Habla y se agregará a la conversación</p>
            </div>
            <div className={`tw-pill ${isListening ? "rec" : ""}`}>
              <span />
              {isListening ? "Escuchando" : "Micrófono listo"}
            </div>
          </header>

          <div className={`tw-speech ${!speechText ? "empty" : ""}`}>
            {speechText || "Pulsa Hablar; al detener, el texto pasa al chat."}
          </div>

          {speechError && <div className="tw-msg error">{speechError}</div>}
          {!speechSupported && (
            <div className="tw-msg error">
              El reconocimiento de voz no está disponible en este navegador.
            </div>
          )}

          <footer className="tw-actions">
            {isListening ? (
              <button type="button" className="tw-danger solid" onClick={stopListening}>
                <MicOff size={15} /> Detener
              </button>
            ) : (
              <button
                type="button"
                className="tw-primary"
                onClick={startListening}
                disabled={!speechSupported}
              >
                <Mic size={15} /> Hablar
              </button>
            )}
            <button type="button" onClick={clearSpeechText} disabled={!speechText}>
              <Eraser size={15} /> Limpiar
            </button>
          </footer>
        </section>
      </aside>
    </div>
  );

}

export default Translator;
