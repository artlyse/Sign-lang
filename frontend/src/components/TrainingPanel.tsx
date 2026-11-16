import { BrainCircuit, Download, Trash2 } from "lucide-react";
import type { TrainingStats } from "../services/training";

interface TrainingPanelProps {
  stats: TrainingStats | null;
  contribute: boolean;
  onContributeChange: (value: boolean) => void;
  busy: boolean;
  message: string;
  onExport: () => void;
  onReset: (label?: string) => void;
}

const ALL_LABELS = [
  ..."ABCDEFGHIKLMNOPQRSTUVWXY".split(""),
  "J",
  "Ñ",
  "Z",
];

export default function TrainingPanel({
  stats,
  contribute,
  onContributeChange,
  busy,
  message,
  onExport,
  onReset,
}: TrainingPanelProps) {
  const byLabel = new Map(stats?.labels.map((item) => [item.label, item]) ?? []);
  const minSamples = stats?.personal_model.min_samples_per_label ?? 3;
  const activeLabels = new Set(stats?.personal_model.active_labels ?? []);
  const pendingExport = stats ? stats.verified - stats.exported : 0;

  return (
    <section className="panel training-panel">
      <div className="panel-heading training-heading">
        <span className="panel-icon tone-violet">
          <BrainCircuit size={18} />
        </span>
        <div>
          <h3>Tu modelo personal</h3>
          <p>
            Cada reto guarda tus landmarks. Las muestras verificadas ajustan el
            reconocimiento a tu forma de hacer las señas.
          </p>
        </div>

        <label className="training-toggle">
          <input
            type="checkbox"
            checked={contribute}
            onChange={(event) => onContributeChange(event.target.checked)}
          />
          <span>Guardar muestras al practicar</span>
        </label>
      </div>

      {!stats ? (
        <div className="statistics-empty">Cargando datos de entrenamiento...</div>
      ) : (
        <>
          {!stats.personal_model.enabled && (
            <div className="language-event-message error">
              El aprendizaje está desactivado en Configuración: no se guardan ni
              usan muestras.
            </div>
          )}

          <div className="training-summary">
            <div>
              <span>Muestras</span>
              <strong>{stats.total}</strong>
            </div>
            <div>
              <span>Verificadas</span>
              <strong>{stats.verified}</strong>
            </div>
            <div>
              <span>Letras aprendidas</span>
              <strong>{activeLabels.size}</strong>
            </div>
            <div>
              <span>Exportadas</span>
              <strong>{stats.exported}</strong>
            </div>
          </div>

          <div className="training-letters">
            {ALL_LABELS.map((label) => {
              const item = byLabel.get(label);
              const verified = item?.verified ?? 0;
              const level = activeLabels.has(label)
                ? "ready"
                : (item?.total ?? 0) > 0
                  ? "partial"
                  : "empty";
              return (
                <button
                  type="button"
                  key={label}
                  className={`training-letter ${level}`}
                  title={
                    item
                      ? `${label}: ${verified} verificadas de ${item.total}${item.kind === "dynamic" ? " (dinámica, solo exportación)" : ""}. Clic para borrar.`
                      : `${label}: sin muestras`
                  }
                  onClick={() => item && onReset(label)}
                  disabled={!item || busy}
                >
                  <strong>{label}</strong>
                  <small>{item && item.total !== verified ? `${verified}/${item.total}` : verified}</small>
                </button>
              );
            })}
          </div>

          <p className="training-legend">
            <span className="dot ready" /> en uso (≥ {minSamples} verificadas)
            <span className="dot partial" /> aprendiendo / pendientes
            <span className="dot empty" /> sin datos
          </p>

          <div className="training-actions">
            <button
              type="button"
              className="secondary-action-button"
              onClick={onExport}
              disabled={busy || pendingExport <= 0}
              title="Escribe las muestras en ai-training/dataset para reentrenar los modelos"
            >
              <Download size={16} /> Exportar al dataset ({Math.max(0, pendingExport)})
            </button>
            <button
              type="button"
              className="secondary-action-button danger"
              onClick={() => onReset()}
              disabled={busy || stats.total === 0}
            >
              <Trash2 size={16} /> Borrar mis muestras
            </button>
          </div>
        </>
      )}

      {message && <div className="language-event-message">{message}</div>}
    </section>
  );
}
