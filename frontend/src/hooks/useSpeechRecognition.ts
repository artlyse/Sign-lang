/**
 * Hook de SpeechRecognition del navegador para convertir la respuesta hablada del personal a texto.
 */

import { useEffect, useRef, useState } from "react";

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  start(): void;
  stop(): void;
  abort(): void;

  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

type SpeechStatus =
  | "idle"
  | "requesting-permission"
  | "ready"
  | "listening"
  | "stopped"
  | "denied"
  | "error";

function joinText(...parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function friendlyError(code: string) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "El navegador no tiene permiso para usar el micrófono.";
    case "audio-capture":
      return "No se encontró un micrófono disponible o está siendo usado por otra aplicación.";
    case "no-speech":
      return "No se detectó voz. Sigue hablando o intenta nuevamente.";
    case "network":
      return "El servicio de reconocimiento de voz del navegador tuvo un problema de red.";
    case "aborted":
      return "";
    default:
      return `Error de reconocimiento de voz: ${code}`;
  }
}

function useSpeechRecognition() {
  const [text, setTextState] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<SpeechStatus>("idle");

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(null);

  const keepListeningRef = useRef(false);
  const startingRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);

  // Texto ya confirmado por el motor. Los resultados provisionales se muestran,
  // pero no se guardan aquí hasta que el navegador los marque como final.
  const committedTextRef = useRef("");
  const visibleTextRef = useRef("");

  const getConstructor = () =>
    (window as SpeechWindow).SpeechRecognition ||
    (window as SpeechWindow).webkitSpeechRecognition;

  const isSupported =
    typeof window !== "undefined" && !!getConstructor();

  const setText = (value: string) => {
    const normalized = value.replace(/\s+/g, " ").trimStart();
    visibleTextRef.current = normalized;
    committedTextRef.current = normalized.trim();
    setTextState(normalized);
  };

  const cleanupRestartTimer = () => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const createAndStartRecognition = () => {
    const SpeechRecognition = getConstructor();

    if (!SpeechRecognition || !keepListeningRef.current) {
      return;
    }

    if (recognitionRef.current || startingRef.current) {
      return;
    }

    startingRef.current = true;

    const recognition = new SpeechRecognition();
    recognition.lang = "es-PE";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      startingRef.current = false;
      recognitionRef.current = recognition;
      setIsListening(true);
      setStatus("listening");
      setError("");
    };

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript?.trim() ?? "";

        if (!transcript) continue;

        if (result.isFinal) {
          finalChunk = joinText(finalChunk, transcript);
        } else {
          interimChunk = joinText(interimChunk, transcript);
        }
      }

      if (finalChunk) {
        committedTextRef.current = joinText(
          committedTextRef.current,
          finalChunk,
        );
      }

      const visible = joinText(
        committedTextRef.current,
        interimChunk,
      );

      visibleTextRef.current = visible;
      setTextState(visible);
    };

    recognition.onerror = (event) => {
      const code = event.error || "unknown";
      const message = friendlyError(code);

      console.error(
        "Error de reconocimiento de voz:",
        code,
        event.message ?? "",
      );

      if (message) {
        setError(message);
      }

      // Estos errores no se solucionan reiniciando automáticamente.
      if (
        code === "not-allowed" ||
        code === "service-not-allowed" ||
        code === "audio-capture" ||
        code === "network"
      ) {
        keepListeningRef.current = false;
        setStatus(
          code === "not-allowed" ||
            code === "service-not-allowed"
            ? "denied"
            : "error",
        );
      }
    };

    recognition.onend = () => {
      startingRef.current = false;
      recognitionRef.current = null;
      setIsListening(false);

      if (keepListeningRef.current) {
        setStatus("ready");

        // Chrome/Edge pueden finalizar una sesión continua por su cuenta.
        // Si el usuario no pulsó Detener, se crea una nueva sesión.
        cleanupRestartTimer();
        restartTimerRef.current = window.setTimeout(() => {
          createAndStartRecognition();
        }, 250);
      } else {
        setStatus("stopped");
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error("No se pudo iniciar SpeechRecognition:", err);
      recognitionRef.current = null;
      startingRef.current = false;
      setIsListening(false);
      setStatus("error");
      setError("No se pudo iniciar el reconocimiento de voz.");
    }
  };

  const requestMicrophonePermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "El navegador no permite acceder al micrófono desde esta página.",
      );
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    // Solo se solicita/verifica permiso. SpeechRecognition administra después
    // su propia captura de audio.
    stream.getTracks().forEach((track) => track.stop());
  };

  const startListening = async () => {
    setError("");

    if (!isSupported) {
      setStatus("error");
      setError(
        "El reconocimiento de voz no está disponible en este navegador.",
      );
      return;
    }

    if (
      recognitionRef.current ||
      startingRef.current ||
      keepListeningRef.current
    ) {
      return;
    }

    cleanupRestartTimer();
    keepListeningRef.current = true;
    setStatus("requesting-permission");

    try {
      await requestMicrophonePermission();

      if (!keepListeningRef.current) {
        return;
      }

      setStatus("ready");
      createAndStartRecognition();
    } catch (err) {
      console.error("Permiso de micrófono rechazado:", err);
      keepListeningRef.current = false;
      startingRef.current = false;
      setIsListening(false);
      setStatus("denied");

      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError")
      ) {
        setError(
          "Debes permitir el acceso al micrófono en el navegador.",
        );
      } else if (
        err instanceof DOMException &&
        err.name === "NotFoundError"
      ) {
        setError("No se encontró ningún micrófono.");
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo acceder al micrófono.",
        );
      }
    }
  };

  const stopListening = () => {
    keepListeningRef.current = false;
    cleanupRestartTimer();
    setStatus("stopped");

    const recognition = recognitionRef.current;
    recognitionRef.current = null;

    if (recognition) {
      try {
        recognition.stop();
      } catch {
        try {
          recognition.abort();
        } catch {
          // Sin acción: ya estaba detenido.
        }
      }
    }

    setIsListening(false);
  };

  const clearText = () => {
    committedTextRef.current = "";
    visibleTextRef.current = "";
    setTextState("");
    setError("");
  };

  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      cleanupRestartTimer();

      try {
        recognitionRef.current?.abort();
      } catch {
        // El motor ya estaba cerrado.
      }

      recognitionRef.current = null;
    };
  }, []);

  return {
    text,
    setText,
    isListening,
    isSupported,
    error,
    status,
    startListening,
    stopListening,
    clearText,
  };
}

export default useSpeechRecognition;
