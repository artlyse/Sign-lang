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

  const loadChallenge = async (
    nextMode = mode,
    nextDifficulty = difficulty,
  ) => {
    setLoadingChallenge(true);
    setError("");
    setResult(null);
    setRecognizedText("");
    setCurrentLetter("-");
    sendCommand({ mode: "clear_language" });

    try {
      const challenge = await getPracticeChallenge(
        nextMode,
        nextDifficulty,
        true,
      );
      setTarget(challenge.text);
      setChallengeSource(challenge.source);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo generar el reto.",
      );
    } finally {
      setLoadingChallenge(false);
    }
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
      });

      setResult(payload);
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

  const modeTitle = {
    letter: "Letra",
    word: "Palabra",
    phrase: "Frase IA",
  }[mode];

  return (
    <div className="page practice-page">
      <div className="page-heading">
        <div>
          <h2>Práctica</h2>
          <p>
            Entrena precisión, velocidad y fluidez con retos progresivos.
          </p>
        </div>

        <div className={`translator-status ${connected ? "connected" : ""}`}>
          <span />
          {connected ? "Reconocimiento conectado" : "Backend desconectado"}
        </div>
      </div>

      <div className="practice-progress-grid">
        <div className="practice-progress-card level">
          <span>Nivel</span>
          <strong>{progress.level}</strong>
          <div className="practice-xp-track">
            <div
              style={{ width: `${Math.min(progress.level_progress, 100)}%` }}
            />
          </div>
          <small>
            {progress.level_xp} / {progress.next_level_xp} XP
          </small>
        </div>

        <div className="practice-progress-card">
          <span>XP total</span>
          <strong>{progress.total_xp}</strong>
          <small>Experiencia acumulada</small>
        </div>

        <div className="practice-progress-card">
          <span>Racha</span>
          <strong>{progress.current_streak}</strong>
          <small>Récord: {progress.best_streak}</small>
        </div>

        <div className="practice-progress-card">
          <span>Precisión media</span>
          <strong>{progress.average_accuracy.toFixed(1)}%</strong>
          <small>Mejor: {progress.best_accuracy.toFixed(1)}%</small>
        </div>
      </div>

      <section className="panel practice-control-panel">
        <div className="practice-mode-tabs">
          {(["letter", "word", "phrase"] as PracticeMode[]).map((item) => (
            <button
              type="button"
              key={item}
              className={mode === item ? "active" : ""}
              onClick={() => {
                if (!active) setMode(item);
              }}
              disabled={active}
            >
              {item === "letter"
                ? "Letra"
                : item === "word"
                  ? "Palabra"
                  : "Frase IA"}
            </button>
          ))}
        </div>

        <div className="practice-recognition-engine">
          <span>Reconocimiento</span>
          <button
            type="button"
            className={recognitionEngine === "letter" ? "active" : ""}
            onClick={() => !active && setRecognitionEngine("letter")}
            disabled={active}
          >
            Por letras
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
            Por palabras
          </button>
        </div>

        <div className="practice-difficulty">
          <span>Dificultad</span>
          {(
            [
              ["beginner", "Inicial"],
              ["intermediate", "Intermedio"],
              ["advanced", "Avanzado"],
            ] as Array<[PracticeDifficulty, string]>
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={difficulty === value ? "active" : ""}
              onClick={() => {
                if (!active) setDifficulty(value);
              }}
              disabled={active}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="practice-grid">
        <section className="panel practice-challenge-panel">
          <div className="practice-eyebrow">
            {modeTitle} · {difficulty}
          </div>

          <h3>Objetivo</h3>

          <div className={`practice-target ${mode}`}>
            {loadingChallenge ? "Generando..." : target || "-"}
          </div>

          <div className="practice-target-meta">
            {mode === "phrase" && (
              <span>
                Fuente: {challengeSource === "qwen" ? "Qwen local" : "biblioteca"}
              </span>
            )}
            <span>Tiempo: {formatDuration(elapsedMs)}</span>
          </div>

          <div className="practice-actions">
            <button
              type="button"
              onClick={() => loadChallenge()}
              disabled={loadingChallenge || active}
            >
              {mode === "phrase" ? "Nueva frase IA" : "Nuevo reto"}
            </button>

            <button
              type="button"
              onClick={() => speak(target)}
              disabled={!ttsSupported || !target}
            >
              Escuchar objetivo
            </button>

            {!active ? (
              <button
                type="button"
                className="translator-primary-button"
                onClick={startAttempt}
                disabled={!target || loadingChallenge}
              >
                Iniciar reto
              </button>
            ) : (
              <button
                type="button"
                className="translator-primary-button"
                onClick={finishAttempt}
                disabled={saving}
              >
                {saving ? "Evaluando..." : "Terminar y evaluar"}
              </button>
            )}
          </div>
        </section>

        <section className="panel practice-camera-panel">
          <div className="translator-panel-title">
            <div>
              <h3>Cámara</h3>
              <p>{cameraStatus}</p>
            </div>
            <span className="camera-live">{active ? "RETO ACTIVO" : "LISTA"}</span>
          </div>

          <div className="camera-controls practice-camera-controls">
            <div className="camera-selector">
              <label htmlFor="practice-camera-select">Cámara</label>
              <select
                id="practice-camera-select"
                value={selectedCamera}
                onChange={(event) => changeCamera(event.target.value)}
                disabled={active}
              >
                {cameras.map((camera, index) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Cámara ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="practice-engine-badge">
              {recognitionEngine === "word"
                ? "2 manos + brazos / pose"
                : "MLP + LSTM de letras"}
            </div>
          </div>

          <div className="translator-camera">
            <video ref={videoRef} autoPlay playsInline muted />
            <canvas ref={canvasRef} width={640} height={480} />
          </div>

          <div className="practice-live-result">
            <div>
              <span>{recognitionEngine === "word" ? "Palabra actual" : "Seña actual"}</span>
              <strong>{currentLetter}</strong>
            </div>
            <div>
              <span>Confianza</span>
              <strong>{(confidence * 100).toFixed(1)}%</strong>
            </div>
          </div>

          <div className="practice-recognized-box">
            <span>Reconocido durante el reto</span>
            <strong>
              {recognizedText ||
                (currentLetter !== "-" ? currentLetter : "-")}
            </strong>
          </div>
        </section>
      </div>

      {result && (
        <section
          className={`panel practice-result ${
            result.attempt.success ? "success" : "retry"
          }`}
        >
          <div>
            <span>Resultado</span>
            <h3>
              {result.attempt.success
                ? "Reto completado"
                : "Sigue practicando"}
            </h3>
          </div>

          <div className="practice-result-metrics">
            <div>
              <span>Precisión</span>
              <strong>{result.attempt.accuracy.toFixed(1)}%</strong>
            </div>
            <div>
              <span>Tiempo</span>
              <strong>{formatDuration(result.attempt.duration_ms)}</strong>
            </div>
            <div>
              <span>XP</span>
              <strong>+{result.attempt.xp_earned}</strong>
            </div>
            <div>
              <span>Racha</span>
              <strong>{result.progress.current_streak}</strong>
            </div>
          </div>

          {result.badge && (
            <div className="practice-badge">{result.badge}</div>
          )}

          <div className="practice-result-comparison">
            <div>
              <span>Objetivo</span>
              <strong>{result.attempt.target_text}</strong>
            </div>
            <div>
              <span>Reconocido</span>
              <strong>{result.attempt.recognized_text || "-"}</strong>
            </div>
          </div>
        </section>
      )}

      {error && <div className="language-event-message error">{error}</div>}

      <section className="panel practice-history-panel">
        <div className="panel-heading">
          <div>
            <h3>Últimos intentos</h3>
            <p>Tu progreso se guarda en SQLite por cuenta.</p>
          </div>
        </div>

        {recentAttempts.length ? (
          <div className="practice-history-list">
            {recentAttempts.map((attempt) => (
              <div className="practice-history-item" key={attempt.id}>
                <div>
                  <strong>{attempt.target_text}</strong>
                  <span>
                    {attempt.mode} · {attempt.difficulty}
                  </span>
                </div>
                <div>
                  <strong>{attempt.accuracy.toFixed(0)}%</strong>
                  <span>{formatDuration(attempt.duration_ms)}</span>
                </div>
                <div className={attempt.success ? "success-text" : "retry-text"}>
                  +{attempt.xp_earned} XP
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="statistics-empty">
            Completa tu primer reto para empezar a construir tu progreso.
          </div>
        )}
      </section>
    </div>
  );
}

export default Practice;
