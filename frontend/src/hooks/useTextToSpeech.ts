/**
 * Hook de SpeechSynthesis del navegador con voz, velocidad, tono y volumen configurables.
 */

import { useCallback, useEffect, useState } from "react";
import { getTtsPreferences } from "../services/preferences";

function useTextToSpeech() {
  const supported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!supported) return;

    const refresh = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string, lang = "es-PE") => {
      if (!supported || !text.trim()) return false;

      window.speechSynthesis.cancel();

      const preferences = getTtsPreferences();
      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = lang;
      utterance.rate = preferences.rate;
      utterance.pitch = preferences.pitch;
      utterance.volume = preferences.volume;

      const voice =
        voices.find((item) => item.voiceURI === preferences.voiceURI) ??
        voices.find((item) =>
          item.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()),
        );

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
      return true;
    },
    [supported, voices],
  );

  return {
    supported,
    voices,
    isSpeaking,
    speak,
    stop,
  };
}

export default useTextToSpeech;
