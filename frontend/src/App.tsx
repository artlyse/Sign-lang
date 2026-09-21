import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const WS_URL = "ws://localhost:8000/ws/recognition";
const MODEL_URL = "/hand_landmarker.task";

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animationRef = useRef<number>(0);

  const [letter, setLetter] = useState<string>("-");
  const [confidence, setConfidence] = useState<number>(0);
  const [status, setStatus] = useState<string>("Iniciando...");
  const [text, setText] = useState<string>("");

  useEffect(() => {
    let stream: MediaStream | null = null;

    const init = async () => {
      try {
        // 1. Conectar WebSocket
        const ws = new WebSocket(WS_URL);
        ws.onopen = () => console.log("WebSocket conectado");
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.letter) {
            setLetter(data.letter);
            setConfidence(data.confidence);
          }
        };
        ws.onerror = (e) => console.error("WebSocket error", e);
        wsRef.current = ws;

        // 2. Cargar MediaPipe
        setStatus("Cargando MediaPipe...");
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
        landmarkerRef.current = landmarker;

        // 3. Abrir cámara
        setStatus("Abriendo camara...");
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus("Listo");
        detectLoop();
      } catch (err) {
        console.error(err);
        setStatus(`Error: ${err}`);
      }
    };

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

          const result = landmarker.detectForVideo(video, performance.now());

          if (result.landmarks && result.landmarks.length > 0) {
            const hand = result.landmarks[0];

            // Dibujar puntos
            ctx.fillStyle = "red";
            for (const lm of hand) {
              const x = lm.x * canvas.width;
              const y = lm.y * canvas.height;
              ctx.beginPath();
              ctx.arc(x, y, 4, 0, 2 * Math.PI);
              ctx.fill();
            }

            // Enviar landmarks al backend
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const flat = hand.flatMap((lm) => [lm.x, lm.y, lm.z]);
              wsRef.current.send(
                JSON.stringify({ mode: "static", landmarks: flat })
              );
            }
          }
        }
      }

      animationRef.current = requestAnimationFrame(detectLoop);
    };

    init();

    return () => {
      cancelAnimationFrame(animationRef.current);
      if (wsRef.current) wsRef.current.close();
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const agregarLetra = () => {
    if (letter && letter !== "-") {
      setText((prev) => prev + letter);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "monospace" }}>
      <h1>Sistema de Reconocimiento de Senas</h1>

      <p>Estado: {status}</p>

      <div style={{ display: "flex", gap: 20 }}>
        <div>
          <h3>Camara</h3>
          <video ref={videoRef} style={{ display: "none" }} />
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            style={{ border: "1px solid black" }}
          />
        </div>

        <div>
          <h3>Reconocimiento</h3>
          <p>
            Letra: <strong style={{ fontSize: 40 }}>{letter}</strong>
          </p>
          <p>Confianza: {(confidence * 100).toFixed(1)}%</p>

          <button onClick={agregarLetra}>Agregar letra al texto</button>
          <button onClick={() => setText("")}>Limpiar texto</button>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Texto construido</h3>
        <div
          style={{
            border: "1px solid black",
            padding: 10,
            minHeight: 40,
            fontSize: 24,
          }}
        >
          {text || "(vacio)"}
        </div>
      </div>
    </div>
  );
}

export default App;