/**
 * Panel izquierdo de Login y Registro. Diseño sobrio: ilustración plana,
 * texto claro y las funciones reales del sistema.
 */
import { Check, Hand } from "lucide-react";
import HandIllustration from "./HandIllustration";

export default function AuthShowcase() {
  return (
    <aside className="auth-showcase">
      <div className="auth-showcase-brand">
        <div className="auth-logo">
          <Hand size={22} strokeWidth={2.2} />
        </div>
        <strong>Sign-lang</strong>
      </div>

      <div className="auth-art" aria-hidden="true">
        <div className="auth-art-circle">
          <HandIllustration scanner={false} skeleton={false} fill="#2563eb" />
        </div>
        <div className="auth-art-bubble">¡Hola!</div>
      </div>

      <div className="auth-copy">
        <h1>Comunicación sin barreras</h1>
        <p>
          Traduce la Lengua de Señas Peruana a texto y voz desde la cámara de
          tu computadora.
        </p>

        <ul className="auth-features">
          <li><Check size={16} /> Traductor en tiempo real</li>
          <li><Check size={16} /> Práctica con niveles y progreso</li>
          <li><Check size={16} /> Se adapta a tu forma de señar</li>
        </ul>
      </div>
    </aside>
  );
}
