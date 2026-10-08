import { FormEvent, useState } from "react";
import { registerAccount } from "../services/auth";

interface RegisterProps {
  onRegistered: () => void;
  onLogin: () => void;
}

export default function Register({
  onRegistered,
  onLogin,
}: RegisterProps) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (!/^[A-Za-z0-9_.-]+$/.test(username)) {
      setError(
        "El usuario solo puede contener letras, números, _, . y -"
      );
      return;
    }

    setLoading(true);

    try {
      await registerAccount({
        username,
        email,
        password,
        display_name: displayName.trim() || undefined,
      });

      onRegistered();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear la cuenta"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">SL</div>
          <h1>Sign Language</h1>
          <p>Traductor Inteligente de Lengua de Señas Peruana</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
            <h2>Crear cuenta</h2>
            <p className="auth-subtitle">
              Regístrate para utilizar el sistema
            </p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <label>
            Nombre
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nombre completo"
              maxLength={100}
            />
          </label>

          <label>
            Usuario
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej. geremias"
              minLength={3}
              maxLength={50}
              required
            />
          </label>

          <label>
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              maxLength={128}
              required
            />
          </label>

          <label>
            Confirmar contraseña
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu contraseña"
              minLength={8}
              required
            />
          </label>

          <button
            className="auth-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>

          <p className="auth-switch">
            ¿Ya tienes una cuenta?{" "}
            <button type="button" onClick={onLogin}>
              Inicia sesión
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}