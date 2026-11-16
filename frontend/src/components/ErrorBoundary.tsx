/**
 * Evita la pantalla en blanco: si un componente lanza un error al renderizar,
 * reintenta una vez (cubre errores transitorios justo después del login) y,
 * si vuelve a fallar, muestra el error con opciones para continuar.
 */
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Cambiar este valor reinicia el boundary (p. ej. al cambiar de página). */
  resetKey?: string;
}

interface State {
  error: Error | null;
  retried: boolean;
  lastKey?: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, retried: false, lastKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.lastKey) {
      return { error: null, retried: false, lastKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error de interfaz:", error, info.componentStack);

    if (!this.state.retried) {
      window.setTimeout(() => this.setState({ error: null, retried: true }), 150);
    }
  }

  render() {
    const { error, retried } = this.state;
    if (!error) return this.props.children;
    if (!retried) return null; // reintento automático en curso

    return (
      <div className="error-screen">
        <div className="panel">
          <h3>Algo salió mal al mostrar esta sección</h3>
          <p>{error.message}</p>
          <div className="error-actions">
            <button
              type="button"
              className="templates-new"
              onClick={() => this.setState({ error: null, retried: false })}
            >
              Reintentar
            </button>
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => window.location.reload()}
            >
              Recargar página
            </button>
          </div>
        </div>
      </div>
    );
  }
}
