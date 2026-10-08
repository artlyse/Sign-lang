import { useEffect, useState } from "react";
import {
  getUserProfile,
  updateUserProfile,
} from "../services/auth";
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

  // Configuraciones locales
  const [showLandmarks, setShowLandmarks] = useState(
    () => localStorage.getItem("show_landmarks") !== "false"
  );

  const [confidence, setConfidence] = useState(
    () => localStorage.getItem("recognition_confidence") || "80"
  );

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
          profile.implicit_learning_enabled
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

        onDisplayNameChange?.(
          updatedProfile.display_name ?? ""
        );

      // Configuración que todavía guardamos localmente
      localStorage.setItem(
        "show_landmarks",
        String(showLandmarks)
      );

      localStorage.setItem(
        "recognition_confidence",
        confidence
      );

      setMessage("Configuración guardada correctamente.");
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
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
          <p>Personaliza el funcionamiento del sistema.</p>
        </div>
      </div>

      <section className="panel settings-panel">
        {/* NOMBRE VISIBLE */}
        <div className="setting-row">
          <div>
            <strong>Nombre visible</strong>
            <p>
              Nombre que se mostrará dentro del sistema.
            </p>
          </div>

          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ej. Levi Pineda"
            maxLength={100}
          />
        </div>

        {/* IDIOMA */}
        <div className="setting-row">
          <div>
            <strong>Idioma de voz</strong>
            <p>
              Idioma utilizado para reconocimiento de voz y TTS.
            </p>
          </div>

          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
          >
            <option value="es-PE">Español - Perú</option>
            <option value="es-ES">Español - España</option>
            <option value="en-US">Inglés - Estados Unidos</option>
          </select>
        </div>

        {/* APRENDIZAJE */}
        <div className="setting-row">
          <div>
            <strong>Aprendizaje del sistema</strong>
            <p>
              Permite utilizar las funciones de aprendizaje
              personalizadas.
            </p>
          </div>

          <input
            type="checkbox"
            checked={learningEnabled}
            onChange={(e) =>
              setLearningEnabled(e.target.checked)
            }
          />
        </div>

        {/* APRENDIZAJE IMPLÍCITO */}
        <div className="setting-row">
          <div>
            <strong>Aprendizaje implícito</strong>
            <p>
              Permite mejorar las sugerencias utilizando
              interacciones del usuario.
            </p>
          </div>

          <input
            type="checkbox"
            checked={implicitLearningEnabled}
            onChange={(e) =>
              setImplicitLearningEnabled(e.target.checked)
            }
            disabled={!learningEnabled}
          />
        </div>

        {/* LANDMARKS */}
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
            onChange={(e) =>
              setShowLandmarks(e.target.checked)
            }
          />
        </div>

        {/* CONFIANZA */}
        <div className="setting-row">
          <div>
            <strong>Confianza mínima</strong>
            <p>
              Nivel mínimo recomendado para aceptar una seña.
            </p>
          </div>

          <select
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
          >
            <option value="70">70%</option>
            <option value="80">80%</option>
            <option value="90">90%</option>
          </select>
        </div>

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