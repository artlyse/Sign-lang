import { useRef, useState } from "react";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;

  start(): void;
  stop(): void;

  onstart: (() => void) | null;
  onend: (() => void) | null;

  onresult:
    | ((event: SpeechRecognitionEvent) => void)
    | null;

  onerror:
    | ((event: SpeechRecognitionErrorEvent) => void)
    | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface SpeechWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function useSpeechRecognition() {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");

  const recognitionRef =
    useRef<SpeechRecognitionInstance | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    !!(
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition
    );

  const startListening = () => {
    setError("");

    const SpeechRecognition =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "El reconocimiento de voz no está disponible en este navegador."
      );
      return;
    }

    // Evitar iniciar dos veces el micrófono
    if (recognitionRef.current) {
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "es-PE";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (
        let i = event.results.length - 1;
        i < event.results.length;
        i++
      ) {
        transcript += event.results[i][0].transcript;
      }

      if (transcript.trim()) {
        setText(transcript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error(
        "Error de reconocimiento de voz:",
        event.error
      );

      if (event.error === "not-allowed") {
        setError(
          "Debes permitir el acceso al micrófono."
        );
      } else if (event.error === "no-speech") {
        setError(
          "No se detectó voz. Intenta nuevamente."
        );
      } else {
        setError(
          `Error del micrófono: ${event.error}`
        );
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error(err);

      recognitionRef.current = null;
      setIsListening(false);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const clearText = () => {
    setText("");
    setError("");
  };

  return {
    text,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    clearText,
  };
}

export default useSpeechRecognition;