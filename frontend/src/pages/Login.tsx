import { FormEvent, useState } from "react";
import { loginAccount } from "../services/auth";

interface LoginProps {
  onLogin: () => void;
  onRegister: () => void;
}

export default function Login({ onLogin, onRegister }: LoginProps) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await loginAccount(login, password);
      onLogin();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo iniciar sesión"
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
            <h2>Iniciar sesión</h2>
            <p className="auth-subtitle">
              Ingresa a tu cuenta para continuar
            </p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <label>
            Usuario o correo electrónico
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="usuario@correo.com"
              minLength={3}
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              minLength={8}
              required
            />
          </label>

          <button
            className="auth-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>

          <p className="auth-switch">
            ¿No tienes una cuenta?{" "}
            <button type="button" onClick={onRegister}>
              Regístrate
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}