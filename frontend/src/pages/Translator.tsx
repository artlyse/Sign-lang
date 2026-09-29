import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";
import useSpeechRecognition from "../hooks/useSpeechRecognition";

const WS_URL = "ws://localhost:8000/ws/recognition";
const MODEL_URL = "/hand_landmarker.task";

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

  const [letter, setLetter] = useState("-");
  const [confidence, setConfidence] = useState(0);
  const [status, setStatus] = useState("Iniciando...");
  const [connected, setConnected] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;

    const detectLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || !canvas || !landmarker) {
        animationRef.current =
          requestAnimationFrame(detectLoop);
        return;
      }

      if (video.readyState === 4) {
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
          );

          ctx.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height
          );

          const result = landmarker.detectForVideo(
            video,
            performance.now()
          );

          if (
            result.landmarks &&
            result.landmarks.length > 0
          ) {
            /*
             * Mostrar todas las manos detectadas.
             */
            for (const hand of result.landmarks) {
              ctx.fillStyle = "#22c55e";

              for (const lm of hand) {
                const x = lm.x * canvas.width;
                const y = lm.y * canvas.height;

                ctx.beginPath();
                ctx.arc(
                  x,
                  y,
                  4,
                  0,
                  Math.PI * 2
                );
                ctx.fill();
              }
            }

            /*
             * El backend actual solamente acepta:
             *
             * 21 landmarks × XYZ = 63 valores.
             *
             * Por eso utilizamos la primera mano
             * para reconocimiento.
             */
            const firstHand =
              result.landmarks[0];

            const landmarks =
              firstHand.flatMap((lm) => [
                lm.x,
                lm.y,
                lm.z,
              ]);

            if (
              wsRef.current?.readyState ===
              WebSocket.OPEN
            ) {
              wsRef.current.send(
                JSON.stringify({
                  mode: "static",
                  landmarks,
                })
              );
            }
          }
        }
      }

      animationRef.current =
        requestAnimationFrame(detectLoop);
    };

    const initialize = async () => {
      try {
        /*
         * WEBSOCKET
         */
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          setConnected(true);
        };

        ws.onclose = () => {
          setConnected(false);
        };

        ws.onerror = () => {
          setConnected(false);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.letter) {
              setLetter(data.letter);
              setConfidence(
                data.confidence ?? 0
              );
            }

            if (data.error) {
              console.warn(
                "Backend:",
                data.error
              );
            }
          } catch (error) {
            console.error(
              "Respuesta WebSocket inválida:",
              error
            );
          }
        };

        wsRef.current = ws;

        /*
         * MEDIAPIPE
         */
        setStatus("Cargando detector...");

        const vision =
          await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
          );

        const landmarker =
          await HandLandmarker.createFromOptions(
            vision,
            {
              baseOptions: {
                modelAssetPath: MODEL_URL,
                delegate: "GPU",
              },

              runningMode: "VIDEO",

              /*
               * Visualmente podemos detectar
               * hasta dos manos.
               */
              numHands: 2,
            }
          );

        landmarkerRef.current = landmarker;

        /*
         * CÁMARA
         */
        setStatus("Abriendo cámara...");

        stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              width: {
                ideal: 1280,
              },

              height: {
                ideal: 720,
              },

              facingMode: "user",
            },

            audio: false,
          });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          await videoRef.current.play();
        }

        setStatus("Cámara activa");

        detectLoop();
      } catch (error) {
        console.error(error);

        setStatus(
          "No se pudo iniciar la cámara"
        );
      }
    };

    initialize();

    return () => {
      cancelAnimationFrame(
        animationRef.current
      );

      wsRef.current?.close();

      landmarkerRef.current?.close();

      if (stream) {
        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }
    };
  }, []);

  const agregarLetra = () => {
    if (letter !== "-") {
      setText(
        (previous) =>
          previous + letter
      );
    }
  };

  const agregarEspacio = () => {
    setText(
      (previous) =>
        previous + " "
    );
  };

  const borrarUltimo = () => {
    setText(
      (previous) =>
        previous.slice(0, -1)
    );
  };

  const limpiar = () => {
    setText("");
  };

  return (
    <div className="page translator-page">

      <div className="page-heading">
        <div>
          <h2>Sing-lang</h2>

          <p>
            Reconocimiento de Lengua de Señas.
          </p>
        </div>

        <div
          className={`translator-status ${
            connected ? "connected" : ""
          }`}
        >
          <span />

          {connected
            ? "Backend conectado"
            : "Backend desconectado"}
        </div>
      </div>

      <div className="translator-grid">

        {/* CÁMARA */}

        <section className="panel translator-camera-panel">

          <div className="translator-panel-title">

            <div>
              <h3>Cámara</h3>

              <p>
                Realiza una seña frente a la cámara
              </p>
            </div>

            <span className="camera-live">
              EN VIVO
            </span>

          </div>

          <div className="translator-camera">

            <video
              ref={videoRef}
              playsInline
              muted
            />

            <canvas
              ref={canvasRef}
              width={640}
              height={480}
            />

            <div className="camera-status">
              {status}
            </div>

          </div>

          <div className="camera-help">
            Mantén las manos visibles dentro
            del área de la cámara.
          </div>

        </section>

        {/* RECONOCIMIENTO */}

        <section className="panel recognition-panel">

          <div className="translator-panel-title">
            <div>
              <h3>Reconocimiento</h3>

              <p>
                Resultado de la seña detectada
              </p>
            </div>
          </div>

          <div className="recognized-sign">

            <span>
              Seña reconocida
            </span>

            <strong>
              {letter}
            </strong>

          </div>

          <div className="translator-confidence">

            <div>
              <span>Confianza</span>

              <strong>
                {(confidence * 100).toFixed(1)}%
              </strong>
            </div>

            <div className="translator-progress">

              <div
                style={{
                  width: `${Math.min(
                    confidence * 100,
                    100
                  )}%`,
                }}
              />

            </div>

          </div>

          <button
            className="translator-primary-button"
            onClick={agregarLetra}
            disabled={letter === "-"}
          >
            + Agregar al mensaje
          </button>

        </section>

      </div>

      {/* MENSAJE */}

      <section className="panel translator-message">

        <div className="translator-panel-title">

          <div>
            <h3>
              Mensaje del cliente
            </h3>

            <p>
              Construye el mensaje utilizando
              las señas reconocidas.
            </p>
          </div>

          <span className="character-counter">
            {text.length} caracteres
          </span>

        </div>

        <div
          className={`translator-text ${
            !text ? "empty" : ""
          }`}
        >
          {text ||
            "El mensaje reconocido aparecerá aquí..."}
        </div>

        <div className="translator-actions">

          <button
            onClick={agregarEspacio}
          >
            Espacio
          </button>

          <button
            onClick={borrarUltimo}
            disabled={!text}
          >
            Borrar último
          </button>

          <button
            className="translator-danger-button"
            onClick={limpiar}
            disabled={!text}
          >
            Limpiar
          </button>

        </div>

      </section>

{/* RESPUESTA DEL PERSONAL */}
<section className="panel staff-response-section">

  {/* Encabezado */}
  <div className="staff-response-header">
    <div>
      <h3>Respuesta del personal</h3>
      <p>
        Convierte la voz del personal en texto para
        facilitar la comunicación con el usuario.
      </p>
    </div>

    <div
      className={`microphone-status ${
        isListening ? "listening" : ""
      }`}
    >
      <span className="microphone-status-dot" />

      {isListening ? "Escuchando" : "Micrófono listo"}
    </div>
  </div>

  {/* Texto reconocido */}
  <div className="speech-content">

    <div className="speech-content-header">
      <span>Texto reconocido por voz</span>

      <span className="speech-character-count">
        {speechText.length} caracteres
      </span>
    </div>

    <div
      className={`speech-result ${
        !speechText ? "empty" : ""
      }`}
    >
      {speechText ||
        "La respuesta hablada aparecerá aquí..."}
    </div>

  </div>

  {/* Errores */}
  {speechError && (
    <div className="speech-error">
      ⚠ {speechError}
    </div>
  )}

  {!speechSupported && (
    <div className="speech-warning">
      ⚠ El reconocimiento de voz no está disponible
      en este navegador.
    </div>
  )}

  {/* Controles */}
  <div className="speech-toolbar">

    <div className="speech-controls">

      <button
        type="button"
        className="speech-button speech-start"
        onClick={startListening}
        disabled={!speechSupported || isListening}
      >
        <span>🎙</span>
        <span>Iniciar micrófono</span>
      </button>

      <button
        type="button"
        className="speech-button speech-stop"
        onClick={stopListening}
        disabled={!isListening}
      >
        <span>■</span>
        <span>Detener</span>
      </button>

      <button
        type="button"
        className="speech-button speech-clear"
        onClick={clearSpeechText}
        disabled={!speechText}
      >
        <span>⌫</span>
        <span>Limpiar respuesta</span>
      </button>

    </div>

    <div className="speech-language">
      <span>Idioma</span>
      <strong>Español (Perú)</strong>
    </div>

  </div>

</section>

    </div>
  );
}

export default Translator;