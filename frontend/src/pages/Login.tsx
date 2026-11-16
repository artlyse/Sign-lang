import { useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
} from "lucide-react";
import { loginAccount } from "../services/auth";
import AuthShowcase from "../components/AuthShowcase";

interface LoginProps {
  onLogin: () => void;
  onRegister: () => void;
}

export default function Login({ onLogin, onRegister }: LoginProps) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        <AuthShowcase />

        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
                        <h2>Iniciar sesión</h2>
            <p className="auth-subtitle">
              Ingresa a tu cuenta para continuar traduciendo
            </p>
          </div>

          {error && (
            <div className="auth-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <label>
            Usuario o correo electrónico
            <div className="auth-input">
              <User size={18} />
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="usuario@correo.com"
                autoComplete="username"
                minLength={3}
                required
              />
            </div>
          </label>

          <label>
            Contraseña
            <div className="auth-input">
              <Lock size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                minLength={8}
                required
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <button className="auth-primary" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="spin" /> Ingresando...
              </>
            ) : (
              <>
                Iniciar sesión <ArrowRight size={18} />
              </>
            )}
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
