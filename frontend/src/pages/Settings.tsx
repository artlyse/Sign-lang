/**
 * Configuración de perfil, aprendizaje, tema, landmarks y preferencias de texto a voz.
 */

import { useEffect, useMemo, useState } from "react";

import {
  getUserProfile,
  updateUserProfile,
} from "../services/auth";
import useTextToSpeech from "../hooks/useTextToSpeech";
import {
  applyTheme,
  getAutoTtsEnabled,
  getAutoTtsMode,
  getStoredTheme,
  getTtsPreferences,
  saveTtsPreferences,
  setAutoTtsEnabled,
  setAutoTtsMode,
} from "../services/preferences";
import type {
  AutoTtsMode,
  ThemePreference,
} from "../services/preferences";

interface SettingsProps {
  onDisplayNameChange?: (name: string) => void;
}

function Settings({
  onDisplayNameChange,
}: SettingsProps) {
  const [displayName, setDisplayName] = useState("");
  const [locale, setLocale] = useState("es-PE");
  const [learningEnabled, setLearningEnabled] = useState(true);
  const [implicitLearningEnabled, setImplicitLearningEnabled] =
    useState(true);

  const [showLandmarks, setShowLandmarks] = useState(
    () => localStorage.getItem("show_landmarks") !== "false",
  );

  const [theme, setTheme] =
    useState<ThemePreference>(() => getStoredTheme());

  const initialTts = useMemo(() => getTtsPreferences(), []);
  const [voiceURI, setVoiceURI] = useState(initialTts.voiceURI);
  const [ttsRate, setTtsRate] = useState(initialTts.rate);
  const [ttsPitch, setTtsPitch] = useState(initialTts.pitch);
  const [ttsVolume, setTtsVolume] = useState(initialTts.volume);
  const [autoTts, setAutoTts] = useState(() => getAutoTtsEnabled());
  const [autoTtsMode, setAutoTtsModeState] =
    useState<AutoTtsMode>(() => getAutoTtsMode());

  const { voices, speak, stop, supported: ttsSupported } =
    useTextToSpeech();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await getUserProfile();

        setDisplayName(profile.display_name ?? "");
        setLocale(profile.locale);
        setLearningEnabled(profile.learning_enabled);
        setImplicitLearningEnabled(
          profile.implicit_learning_enabled,
        );
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar la configuración.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleTheme = (value: ThemePreference) => {
    setTheme(value);
    applyTheme(value);
  };

  const persistLocalSettings = () => {
    localStorage.setItem("show_landmarks", String(showLandmarks));
    applyTheme(theme);
    saveTtsPreferences({
      voiceURI,
      rate: ttsRate,
      pitch: ttsPitch,
      volume: ttsVolume,
    });
    setAutoTtsEnabled(autoTts);
    setAutoTtsMode(autoTtsMode);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const updatedProfile = await updateUserProfile({
        display_name: displayName.trim() || null,
        locale,
        learning_enabled: learningEnabled,
        implicit_learning_enabled: implicitLearningEnabled,
      });

      setDisplayName(updatedProfile.display_name ?? "");
      onDisplayNameChange?.(updatedProfile.display_name ?? "");

      persistLocalSettings();
      setMessage("Configuración guardada correctamente.");
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  const testVoice = () => {
    saveTtsPreferences({
      voiceURI,
      rate: ttsRate,
      pitch: ttsPitch,
      volume: ttsVolume,
    });

    speak(
      "Hola. Esta es una prueba de la voz configurada en Sign Lang.",
      locale,
    );
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-heading">
          <div>
            <h2>Configuración</h2>
            <p>Cargando configuración...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2>Configuración</h2>
          <p>
            Personaliza cuenta, apariencia, cámara y locutor.
          </p>
        </div>
      </div>

      <section className="panel settings-panel">
        <div className="settings-section-title">
          <span>Cuenta</span>
          <h3>Perfil y aprendizaje</h3>
        </div>

        <div className="setting-row">
          <div>
            <strong>Nombre visible</strong>
            <p>Nombre mostrado dentro del sistema.</p>
          </div>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Ej. Levi Pineda"
            maxLength={100}
          />
        </div>

        <div className="setting-row">
          <div>
            <strong>Idioma</strong>
            <p>
              Idioma utilizado para reconocimiento y síntesis de voz.
            </p>
          </div>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
          >
            <option value="es-PE">Español - Perú</option>
            <option value="es-ES">Español - España</option>
            <option value="en-US">Inglés - Estados Unidos</option>
          </select>
        </div>

        <div className="setting-row">
          <div>
            <strong>Aprendizaje del sistema</strong>
            <p>
              Permite utilizar correcciones para personalizar el sistema.
            </p>
          </div>
          <input
            type="checkbox"
            checked={learningEnabled}
            onChange={(event) =>
              setLearningEnabled(event.target.checked)
            }
          />
        </div>

        <div className="setting-row">
          <div>
            <strong>Aprendizaje implícito</strong>
            <p>
              Aprende débilmente de correcciones aceptadas al continuar.
            </p>
          </div>
          <input
            type="checkbox"
            checked={implicitLearningEnabled}
            onChange={(event) =>
              setImplicitLearningEnabled(event.target.checked)
            }
            disabled={!learningEnabled}
          />
        </div>

        <div className="settings-section-title">
          <span>Apariencia</span>
          <h3>Interfaz</h3>
        </div>

        <div className="setting-row">
          <div>
            <strong>Tema</strong>
            <p>
              Usa tema claro, oscuro o el configurado en el sistema.
            </p>
          </div>
          <select
            value={theme}
            onChange={(event) =>
              handleTheme(event.target.value as ThemePreference)
            }
          >
            <option value="system">Sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </div>

        <div className="setting-row">
          <div>
            <strong>Mostrar landmarks</strong>
            <p>
              Mostrar los puntos detectados sobre las manos.
            </p>
          </div>
          <input
            type="checkbox"
            checked={showLandmarks}
            onChange={(event) =>
              setShowLandmarks(event.target.checked)
            }
          />
        </div>

        <div className="settings-section-title">
          <span>Locutor</span>
          <h3>Texto a voz del navegador</h3>
        </div>

        <div className="setting-row">
          <div>
            <strong>Lectura automática de la traducción</strong>
            <p>
              Cuando se finaliza una palabra o Qwen corrige una oración,
              el navegador la lee automáticamente. También puede activarse
              o desactivarse directamente desde Traductor.
            </p>
          </div>
          <input
            type="checkbox"
            checked={autoTts}
            onChange={(event) => setAutoTts(event.target.checked)}
            disabled={!ttsSupported}
          />
        </div>


        <div className="setting-row">
          <div>
            <strong>Modo de lectura automática</strong>
            <p>
              “Solo palabras nuevas” lee únicamente lo recién agregado.
              “Lectura corrida” vuelve a leer toda la oración desde el inicio
              cada vez que entra una palabra o seña de palabra.
            </p>
          </div>
          <select
            value={autoTtsMode}
            onChange={(event) =>
              setAutoTtsModeState(event.target.value as AutoTtsMode)
            }
            disabled={!ttsSupported || !autoTts}
          >
            <option value="new_words">Solo palabras nuevas</option>
            <option value="continuous">Lectura corrida</option>
          </select>
        </div>

        <div className="setting-row">
          <div>
            <strong>Voz</strong>
            <p>
              Las voces disponibles dependen del navegador y Windows.
            </p>
          </div>
          <select
            value={voiceURI}
            onChange={(event) => setVoiceURI(event.target.value)}
            disabled={!ttsSupported}
          >
            <option value="">Automática</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} · {voice.lang}
              </option>
            ))}
          </select>
        </div>

        <div className="setting-row setting-range-row">
          <div>
            <strong>Velocidad</strong>
            <p>{ttsRate.toFixed(1)}×</p>
          </div>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={ttsRate}
            onChange={(event) =>
              setTtsRate(Number(event.target.value))
            }
          />
        </div>

        <div className="setting-row setting-range-row">
          <div>
            <strong>Tono</strong>
            <p>{ttsPitch.toFixed(1)}</p>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={ttsPitch}
            onChange={(event) =>
              setTtsPitch(Number(event.target.value))
            }
          />
        </div>

        <div className="setting-row setting-range-row">
          <div>
            <strong>Volumen</strong>
            <p>{Math.round(ttsVolume * 100)}%</p>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={ttsVolume}
            onChange={(event) =>
              setTtsVolume(Number(event.target.value))
            }
          />
        </div>

        <div className="settings-voice-actions">
          <button
            type="button"
            onClick={testVoice}
            disabled={!ttsSupported}
          >
            Probar voz
          </button>
          <button
            type="button"
            onClick={stop}
            disabled={!ttsSupported}
          >
            Detener
          </button>
        </div>

        {!ttsSupported && (
          <div className="settings-message settings-error">
            Este navegador no expone SpeechSynthesis.
          </div>
        )}

        {error && (
          <div className="settings-message settings-error">
            {error}
          </div>
        )}

        {message && (
          <div className="settings-message settings-success">
            {message}
          </div>
        )}

        <div className="settings-actions">
          <button
            type="button"
            className="settings-save-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default Settings;
