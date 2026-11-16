import { useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  AtSign,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import { registerAccount } from "../services/auth";
import AuthShowcase from "../components/AuthShowcase";

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

  const [showPassword, setShowPassword] = useState(false);
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
        <AuthShowcase />

        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
                        <h2>Crear cuenta</h2>
            <p className="auth-subtitle">
              Regístrate para utilizar el sistema
            </p>
          </div>

          {error && (
            <div className="auth-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <label>
            Nombre
            <div className="auth-input">
              <User size={18} />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nombre completo"
                maxLength={100}
              />
            </div>
          </label>

          <label>
            Usuario
            <div className="auth-input">
              <AtSign size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. geremias"
                minLength={3}
                maxLength={50}
                required
              />
            </div>
          </label>

          <label>
            Correo electrónico
            <div className="auth-input">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
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
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                maxLength={128}
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

          <label>
            Confirmar contraseña
            <div className="auth-input">
              <ShieldCheck size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                minLength={8}
                required
              />
            </div>
          </label>

          <button
            className="auth-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spin" /> Creando cuenta...
              </>
            ) : (
              <>
                <UserPlus size={18} /> Crear cuenta
              </>
            )}
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