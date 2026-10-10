/**
 * Persistencia local de tema y opciones de SpeechSynthesis/TTS.
 */

export type ThemePreference = "light" | "dark" | "system";

export const THEME_KEY = "signlang_theme";
export const TTS_VOICE_KEY = "signlang_tts_voice";
export const TTS_RATE_KEY = "signlang_tts_rate";
export const TTS_PITCH_KEY = "signlang_tts_pitch";
export const TTS_VOLUME_KEY = "signlang_tts_volume";
export const AUTO_TTS_KEY = "signlang_auto_tts";
export const AUTO_TTS_MODE_KEY = "signlang_auto_tts_mode";

export type AutoTtsMode = "new_words" | "continuous";

export function resolvedTheme(
  preference: ThemePreference,
): "light" | "dark" {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(preference: ThemePreference) {
  localStorage.setItem(THEME_KEY, preference);
  document.documentElement.dataset.theme = resolvedTheme(preference);
  document.documentElement.dataset.themePreference = preference;
}

export function applyStoredTheme() {
  const raw = localStorage.getItem(THEME_KEY);
  const preference: ThemePreference =
    raw === "dark" || raw === "light" || raw === "system"
      ? raw
      : "system";

  applyTheme(preference);
  return preference;
}

export function getStoredTheme(): ThemePreference {
  const raw = localStorage.getItem(THEME_KEY);
  return raw === "dark" || raw === "light" || raw === "system"
    ? raw
    : "system";
}

export type TtsPreferences = {
  voiceURI: string;
  rate: number;
  pitch: number;
  volume: number;
};

function readNumber(key: string, fallback: number) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

export function getTtsPreferences(): TtsPreferences {
  return {
    voiceURI: localStorage.getItem(TTS_VOICE_KEY) ?? "",
    rate: Math.min(2, Math.max(0.5, readNumber(TTS_RATE_KEY, 1))),
    pitch: Math.min(2, Math.max(0, readNumber(TTS_PITCH_KEY, 1))),
    volume: Math.min(1, Math.max(0, readNumber(TTS_VOLUME_KEY, 1))),
  };
}

export function saveTtsPreferences(value: TtsPreferences) {
  localStorage.setItem(TTS_VOICE_KEY, value.voiceURI);
  localStorage.setItem(TTS_RATE_KEY, String(value.rate));
  localStorage.setItem(TTS_PITCH_KEY, String(value.pitch));
  localStorage.setItem(TTS_VOLUME_KEY, String(value.volume));
}

export function getAutoTtsEnabled() {
  return localStorage.getItem(AUTO_TTS_KEY) === "true";
}

export function setAutoTtsEnabled(enabled: boolean) {
  localStorage.setItem(AUTO_TTS_KEY, String(enabled));
}


export function getAutoTtsMode(): AutoTtsMode {
  const value = localStorage.getItem(AUTO_TTS_MODE_KEY);
  return value === "continuous" ? "continuous" : "new_words";
}

export function setAutoTtsMode(mode: AutoTtsMode) {
  localStorage.setItem(AUTO_TTS_MODE_KEY, mode);
}
