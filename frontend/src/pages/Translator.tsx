import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";
import useSpeechRecognition from "../hooks/useSpeechRecognition";

const WS_URL = "ws://localhost:8000/ws/recognition";

const buildWsUrl = () => {
  const token = window.localStorage.getItem("signlang_access_token");
  if (!token) return WS_URL;
  const separator = WS_URL.includes("?") ? "&" : "?";
  return `${WS_URL}${separator}token=${encodeURIComponent(token)}`;
};

const MODEL_URL = "/hand_landmarker.task";

const RECOGNITION_FPS = 30;
const SEND_INTERVAL_MS = 1000 / RECOGNITION_FPS;

// Si J/Z no coinciden con la orientacion usada durante entrenamiento, prueba true.
const MIRROR_LANDMARK_X = false;

// Si la mano permanece fuera este tiempo, se cierra/corrige la palabra.
// Una ausencia mas corta solo desbloquea letras repetidas, por ejemplo LL.
const WORD_GAP_MS = 950;

type RecognitionMode = "static" | "dynamic" | "none";

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animationRef = useRef<number>(0);
  const lastSentAtRef = useRef<number>(0);
  const frameInFlightRef = useRef(false);
  const frameRequestIdRef = useRef(0);
  const frameTimeoutRef = useRef<number | null>(null);
  const hadHandRef = useRef(false);
  const wordGapTimerRef = useRef<number | null>(null);

  const [letter, setLetter] = useState("-");
  const [confidence, setConfidence] = useState(0);
  const [recognitionMode, setRecognitionMode] =
    useState<RecognitionMode>("none");
  const [status, setStatus] = useState("Iniciando...");
  const [connected, setConnected] = useState(false);
  const [language, setLanguage] = useState<LanguageState>(
    EMPTY_LANGUAGE_STATE,
  );
  const [manualCorrection, setManualCorrection] = useState("");
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [aiSentence, setAiSentence] = useState("");
  const [aiCorrecting, setAiCorrecting] = useState(false);
  const [aiCorrectionError, setAiCorrectionError] = useState("");

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
    let stream: MediaStream | null = null;

    const detectLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || !canvas || !landmarker) {
        animationRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      if (video.readyState === 4) {
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const result = landmarker.detectForVideo(
            video,
            performance.now(),
          );

          if (result.landmarks && result.landmarks.length > 0) {
            cancelWordGapTimer();

            for (const hand of result.landmarks) {
              ctx.fillStyle = "#22c55e";

              for (const lm of hand) {
                const x = lm.x * canvas.width;
                const y = lm.y * canvas.height;

                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
              }
            }

            const firstHand = result.landmarks[0];
            hadHandRef.current = true;

            const landmarks = firstHand.flatMap((lm) => [
              MIRROR_LANDMARK_X ? 1 - lm.x : lm.x,
              lm.y,
              lm.z,
            ]);

            const now = performance.now();

            if (
              now - lastSentAtRef.current >= SEND_INTERVAL_MS &&
              wsRef.current?.readyState === WebSocket.OPEN &&
              !frameInFlightRef.current
            ) {
              lastSentAtRef.current = now;
              frameInFlightRef.current = true;
              frameRequestIdRef.current += 1;

              const requestId = frameRequestIdRef.current;

              wsRef.current.send(
                JSON.stringify({
                  mode: "hybrid",
                  request_id: requestId,
                  timestamp_ms: now,
                  landmarks,
                }),
              );

              // Seguridad: si una respuesta se pierde, no congelamos la cámara.
              clearFrameTimeout();
              frameTimeoutRef.current = window.setTimeout(() => {
                frameInFlightRef.current = false;
                frameTimeoutRef.current = null;
              }, 700);
            }
          } else if (hadHandRef.current) {
            // La mano acaba de desaparecer.
            hadHandRef.current = false;
            lastSentAtRef.current = 0;

            sendCommand({ mode: "hand_absent" });
            scheduleWordFinalization();
          }
        }
      }

      animationRef.current = requestAnimationFrame(detectLoop);
    };

    const initialize = async () => {
      try {
        const ws = new WebSocket(buildWsUrl());

        ws.onopen = () => {
          releaseFrame();
          setConnected(true);
          setStatus("Backend conectado");
          ws.send(JSON.stringify({ mode: "get_language_state" }));
        };

        ws.onclose = () => {
          releaseFrame();
          setConnected(false);
          setStatus("Backend desconectado");
        };

        ws.onerror = () => {
          releaseFrame();
          setConnected(false);
          setStatus("Error de conexion con backend");
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // El backend responde primero la inferencia visual. Esto libera
            // inmediatamente el siguiente frame y evita acumular retraso.
            if (data.kind === "recognition" || data.letter !== undefined) {
              releaseFrame();
            }

            if (typeof data.letter === "string") {
              setLetter(data.letter || "-");
              setConfidence(Number(data.confidence ?? 0));
              setRecognitionMode(
                data.mode === "dynamic"
                  ? "dynamic"
                  : data.mode === "static"
                    ? "static"
                    : "none",
              );
            }

            if (data.language) {
              setLanguage(data.language as LanguageState);
            }

            if (data.kind === "sentence_correction") {
              setAiCorrecting(false);
              const correction = data.sentence_correction;
              if (correction?.corrected) {
                setAiSentence(String(correction.corrected));
                setAiCorrectionError("");
              } else {
                setAiCorrectionError("No se pudo generar una corrección contextual.");
              }
            }

            if (data.error) {
              setAiCorrecting(false);
              if (String(data.error).toLowerCase().includes("modelo contextual")
                  || String(data.error).toLowerCase().includes("torch")
                  || String(data.error).toLowerCase().includes("transform")) {
                setAiCorrectionError(String(data.error));
              }
              releaseFrame();
              console.warn("Backend:", data.error);
              setStatus(`Backend: ${String(data.error)}`);
            }
          } catch (error) {
            console.error("Respuesta WebSocket invalida:", error);
          }
        };

        wsRef.current = ws;

        setStatus("Cargando detector...");

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

        landmarkerRef.current = landmarker;

        setStatus("Abriendo camara...");

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus("Camara activa");
        detectLoop();
      } catch (error) {
        console.error(error);
        setStatus("No se pudo iniciar la camara");
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

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

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

  const corregirOracionIA = () => {
    const sentence = language.display_text.trim();

    if (!sentence && !language.raw_word) return;

    setAiCorrecting(true);
    setAiCorrectionError("");

    sendCommand({
      mode: "correct_sentence",
      sentence,
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


  return (
    <div className="page translator-page">
      <div className="page-heading">
        <div>
          <h2>Sing-lang</h2>
          <p>Reconocimiento de Lengua de Señas.</p>
        </div>

        <div
          className={`translator-status ${connected ? "connected" : ""}`}
        >
          <span />
          {connected ? "Backend conectado" : "Backend desconectado"}
        </div>
      </div>

      <div className="translator-grid">
        <section className="panel translator-camera-panel">
          <div className="translator-panel-title">
            <div>
              <h3>Camara</h3>
              <p>Realiza una seña frente a la camara</p>
            </div>
            <span className="camera-live">EN VIVO</span>
          </div>

          <div className="translator-camera">
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} width={640} height={480} />
            <div className="camera-status">{status}</div>
          </div>

          <div className="camera-help">
            Las letras se agregan automaticamente cuando la prediccion es estable.
          </div>
        </section>

        <section className="panel recognition-panel">
          <div className="translator-panel-title">
            <div>
              <h3>Reconocimiento</h3>
              <p>
                Resultado de la seña detectada
                {recognitionMode === "dynamic"
                  ? " · Dinamica"
                  : recognitionMode === "static"
                    ? " · Estatica"
                    : ""}
              </p>
            </div>
          </div>

          <div className="recognized-sign">
            <span>Seña reconocida</span>
            <strong>{letter}</strong>
          </div>

          <div className="translator-confidence">
            <div>
              <span>Confianza</span>
              <strong>{(confidence * 100).toFixed(1)}%</strong>
            </div>

            <div className="translator-progress">
              <div
                style={{
                  width: `${Math.min(confidence * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          <div className="language-capture-status">
            <span>Palabra interpretada</span>
            <strong>
              {language.resolved_word || language.preview_word || language.raw_word || "-"}
            </strong>
          </div>

          <button
            className="translator-primary-button"
            onClick={finalizarPalabra}
            disabled={!language.raw_word}
          >
            Finalizar palabra
          </button>
        </section>
      </div>

      <section className="panel translator-message">
        <div className="translator-panel-title">
          <div>
            <h3>Construccion de la oracion</h3>
            <p>
              El corrector propone palabras segun errores visuales, frecuencia y contexto.
            </p>
          </div>
          <span className="character-counter">
            {language.display_text.length} caracteres
          </span>
        </div>

        <div className="language-word-grid">
          <div className="language-word-card corrected">
            <span>Secuencia reconocida</span>
            <strong>
              {language.resolved_word || language.preview_word || language.raw_word || "-"}
            </strong>
          </div>

          <div className="language-word-card">
            <span>Captura original</span>
            <strong>{language.raw_word || "-"}</strong>
          </div>
        </div>

        <div className="language-suggestions">
          <span className="language-suggestions-label">
            {language.suggestion_scope === "last_finalized"
              ? `Sugerencias para la última palabra: ${language.suggestion_source_word || ""}`
              : "Sugerencias"}
          </span>

          <div className="language-suggestion-buttons">
            {language.suggestions.length > 0 ? (
              language.suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={`${suggestion.word}-${suggestion.score}`}
                  onClick={() => elegirSugerencia(suggestion.word)}
                  title={`Score ${(suggestion.score * 100).toFixed(1)}%`}
                >
                  <strong>{suggestion.word}</strong>
                  <span>{(suggestion.score * 100).toFixed(0)}%</span>
                </button>
              ))
            ) : (
              <span className="language-no-suggestions">
                {language.suggestion_scope === "last_finalized"
                  ? "No hay alternativas guardadas para la última palabra."
                  : "Escribe al menos dos letras para obtener sugerencias."}
              </span>
            )}
          </div>
        </div>

        <div
          className={`translator-text ${
            !language.display_text ? "empty" : ""
          }`}
        >
          {language.sentence_words.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
              }}
            >
              {language.sentence_words.map((word, index) => (
                <button
                  key={`${index}-${word}`}
                  type="button"
                  onClick={() => setSelectedWordIndex(index)}
                  title="Haz clic para ver sugerencias de esta palabra"
                  style={{
                    border:
                      selectedWordIndex === index
                        ? "2px solid currentColor"
                        : "1px solid rgba(128, 128, 128, 0.35)",
                    borderRadius: "10px",
                    padding: "7px 10px",
                    background:
                      selectedWordIndex === index
                        ? "rgba(128, 128, 128, 0.16)"
                        : "transparent",
                    cursor: "pointer",
                    font: "inherit",
                    fontWeight: 700,
                  }}
                >
                  {word}
                </button>
              ))}

              {language.resolved_word && (
                <span style={{ fontWeight: 700 }}>
                  {language.resolved_word}
                </span>
              )}
            </div>
          ) : (
            language.resolved_word ||
            "La oracion corregida aparecera aqui..."
          )}
        </div>

        {selectedSentenceItem && (
          <div className="language-suggestions">
            <span className="language-suggestions-label">
              Sugerencias para: {selectedSentenceItem.word}
              {selectedSentenceItem.raw &&
              selectedSentenceItem.raw !== selectedSentenceItem.word
                ? ` · capturado: ${selectedSentenceItem.raw}`
                : ""}
            </span>

            <div className="language-suggestion-buttons">
              {selectedSentenceItem.suggestions.length > 0 ? (
                selectedSentenceItem.suggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={`selected-${selectedSentenceItem.index}-${suggestion.word}-${suggestion.score}`}
                    onClick={() =>
                      elegirSugerenciaDePalabra(suggestion.word)
                    }
                    title={`Score ${(suggestion.score * 100).toFixed(1)}%`}
                  >
                    <strong>{suggestion.word}</strong>
                    <span>{(suggestion.score * 100).toFixed(0)}%</span>
                  </button>
                ))
              ) : (
                <span className="language-no-suggestions">
                  No hay sugerencias guardadas para esta palabra.
                </span>
              )}
            </div>
          </div>
        )}

        <div className="language-word-grid">
          <div className="language-word-card corrected">
            <span>Oración contextual (IA)</span>
            <strong>
              {aiSentence ||
                "Finaliza varias palabras y usa “Corregir oración con IA”."}
            </strong>
          </div>
        </div>

        {aiCorrectionError && (
          <div className="language-event-message error">
            {aiCorrectionError}
          </div>
        )}

        {language.event?.type === "word_finalized" && (
          <div className="language-event-message">
            Palabra agregada: {String(language.event.word ?? "")}
          </div>
        )}

        {language.event?.type === "last_word_replaced" && (
          <div className="language-event-message">
            Última palabra cambiada: {String(language.event.previous_word ?? "")}
            {" → "}
            {String(language.event.word ?? "")}
          </div>
        )}

        {language.event?.type === "sentence_word_replaced" && (
          <div className="language-event-message">
            Palabra cambiada: {String(language.event.previous_word ?? "")}
            {" → "}
            {String(language.event.word ?? "")}
          </div>
        )}

        {language.learning?.pending_feedback && (
          <div className="learning-feedback-card">
            <div className="learning-feedback-header">
              <div>
                <h4>Corrección automática</h4>
                <p>
                  Si continúas con la siguiente palabra, el sistema usa esta
                  corrección como aprendizaje débil de forma automática.
                </p>
              </div>
              <span>Aprendizaje adaptativo</span>
            </div>

            <div className="learning-feedback-comparison">
              <div>
                <span>Reconocido</span>
                <strong>{language.learning.pending_feedback.raw}</strong>
              </div>
              <div className="learning-arrow">→</div>
              <div>
                <span>Interpretado</span>
                <strong>{language.learning.pending_feedback.predicted}</strong>
              </div>
            </div>

            <div className="learning-correction-row">
              <input
                type="text"
                value={manualCorrection}
                onChange={(event) => setManualCorrection(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    corregirYAprender();
                  }
                }}
                placeholder="Solo corrige si el resultado está mal"
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

        <div className="learning-stats-bar">
          <span>
            Correcciones aprendidas: {language.learning?.stats?.memory?.feedback_count ?? 0}
          </span>
          <span>
            Confusiones: {language.learning?.stats?.memory?.learned_substitution_pairs ?? 0}
          </span>
          <span>
            Ranker ML: {language.learning?.stats?.ranker?.trained_feedback ?? 0} feedback
          </span>
          <span>
            Peso ML: {(((language.learning?.stats?.ranker?.effective_weight ?? 0) * 100)).toFixed(0)}%
          </span>
        </div>

        {language.error && (
          <div className="language-event-message error">
            {language.error}
          </div>
        )}

        <div className="translator-actions">
          <button
            className="translator-primary-button"
            onClick={corregirOracionIA}
            disabled={
              aiCorrecting ||
              (!language.display_text.trim() && !language.raw_word)
            }
          >
            {aiCorrecting ? "Corrigiendo con IA..." : "Corregir oración con IA"}
          </button>

          <button onClick={finalizarPalabra} disabled={!language.raw_word}>
            Finalizar palabra
          </button>

          <button
            onClick={borrarUltimo}
            disabled={!language.raw_word && language.sentence_words.length === 0}
          >
            Borrar ultimo
          </button>

          <button
            className="translator-danger-button"
            onClick={limpiar}
            disabled={!language.raw_word && language.sentence_words.length === 0}
          >
            Limpiar
          </button>
        </div>

        <div className="language-help">
          Retira la mano menos de {WORD_GAP_MS} ms para repetir una letra. Si la
          mantienes fuera aproximadamente 1 segundo, la palabra se finaliza y se
          corrige automaticamente.
        </div>
      </section>

      <section className="panel staff-response-section">
        <div className="staff-response-header">
          <div>
            <h3>Respuesta del personal</h3>
            <p>
              Convierte la voz del personal en texto para facilitar la comunicacion
              con el usuario.
            </p>
          </div>

          <div
            className={`microphone-status ${isListening ? "listening" : ""}`}
          >
            <span className="microphone-status-dot" />
            {isListening ? "Escuchando" : "Microfono listo"}
          </div>
        </div>

        <div className="speech-content">
          <div className="speech-content-header">
            <span>Texto reconocido por voz</span>
            <span className="speech-character-count">
              {speechText.length} caracteres
            </span>
          </div>

          <div className={`speech-result ${!speechText ? "empty" : ""}`}>
            {speechText || "La respuesta hablada aparecera aqui..."}
          </div>
        </div>

        {speechError && <div className="speech-error">{speechError}</div>}

        {!speechSupported && (
          <div className="speech-warning">
            El reconocimiento de voz no esta disponible en este navegador.
          </div>
        )}

        <div className="speech-toolbar">
          <div className="speech-controls">
            <button
              type="button"
              className="speech-button speech-start"
              onClick={startListening}
              disabled={!speechSupported || isListening}
            >
              <span>Iniciar microfono</span>
            </button>

            <button
              type="button"
              className="speech-button speech-stop"
              onClick={stopListening}
              disabled={!isListening}
            >
              <span>Detener</span>
            </button>

            <button
              type="button"
              className="speech-button speech-clear"
              onClick={clearSpeechText}
              disabled={!speechText}
            >
              <span>Limpiar respuesta</span>
            </button>
          </div>

          <div className="speech-language">
            <span>Idioma</span>
            <strong>Español (Peru)</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Translator;
