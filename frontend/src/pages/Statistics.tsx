/**
 * Vista de estadísticas calculadas desde sesiones y predicciones reales del backend.
 */

import { useEffect, useMemo, useState } from "react";
import StatCard from "../components/StatCard";
import {
  loadRecognitionStatistics,
  type RecognitionStats,
} from "../services/statistics";

const EMPTY_STATS: RecognitionStats = {
  sessions: [],
  predictions: [],
  totalSessions: 0,
  totalPredictions: 0,
  averageConfidence: 0,
  staticPredictions: 0,
  dynamicPredictions: 0,
  topRecognitions: [],
  recentPredictions: [],
};

function formatDate(value: string | null) {
  if (!value) return "En curso";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Statistics() {
  const [stats, setStats] = useState<RecognitionStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = async () => {
    setLoading(true);
    setError("");

    try {
      setStats(await loadRecognitionStatistics(30));
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las estadísticas",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const totalClassified = stats.staticPredictions + stats.dynamicPredictions;

  const modeDistribution = useMemo(
    () => [
      {
        label: "Estáticas",
        value: stats.staticPredictions,
        percentage:
          totalClassified > 0
            ? (stats.staticPredictions / totalClassified) * 100
            : 0,
      },
      {
        label: "Dinámicas",
        value: stats.dynamicPredictions,
        percentage:
          totalClassified > 0
            ? (stats.dynamicPredictions / totalClassified) * 100
            : 0,
      },
    ],
    [stats.staticPredictions, stats.dynamicPredictions, totalClassified],
  );

  return (
    <div className="page">
      <div className="page-heading statistics-heading">
        <div>
          <h2>Estadísticas</h2>
          <p>Datos reales de tus sesiones de reconocimiento.</p>
        </div>

        <button
          type="button"
          className="secondary-action-button"
          onClick={loadStats}
          disabled={loading}
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error && (
        <div className="statistics-state error">
          <strong>No se pudieron cargar los datos.</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          title="Reconocimientos"
          value={loading ? "—" : stats.totalPredictions}
          description="Últimas 30 sesiones"
          icon="▦"
        />
        <StatCard
          title="Sesiones"
          value={loading ? "—" : stats.totalSessions}
          description="Sesiones analizadas"
          icon="◉"
        />
        <StatCard
          title="Confianza promedio"
          value={
            loading
              ? "—"
              : stats.predictions.length
                ? `${(stats.averageConfidence * 100).toFixed(1)}%`
                : "0%"
          }
          description="Sobre predicciones almacenadas"
          icon="✓"
        />
        <StatCard
          title="Señas dinámicas"
          value={loading ? "—" : stats.dynamicPredictions}
          description="J, Ñ, Z y otras dinámicas"
          icon="↝"
        />
      </div>

      {loading ? (
        <section className="panel statistics-state">
          <strong>Cargando estadísticas...</strong>
          <span>Consultando sesiones y predicciones del usuario.</span>
        </section>
      ) : stats.totalSessions === 0 ? (
        <section className="panel statistics-state">
          <strong>Aún no hay sesiones registradas</strong>
          <span>
            Usa el Traductor con tu cuenta iniciada para empezar a generar datos.
          </span>
        </section>
      ) : (
        <>
          <div className="statistics-layout">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>Reconocimientos frecuentes</h3>
                  <p>Ranking calculado a partir de tus predicciones guardadas.</p>
                </div>
              </div>

              {stats.topRecognitions.length > 0 ? (
                <div className="recognition-ranking">
                  {stats.topRecognitions.map((item, index) => (
                    <div className="recognition-ranking-row" key={item.text}>
                      <span className="ranking-position">{index + 1}</span>
                      <strong>{item.text}</strong>
                      <div className="ranking-bar-track">
                        <div
                          className="ranking-bar-fill"
                          style={{ width: `${Math.max(item.percentage, 4)}%` }}
                        />
                      </div>
                      <small>{item.count}</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="statistics-empty">No hay predicciones guardadas.</div>
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>Tipo de reconocimiento</h3>
                  <p>Distribución de predicciones estáticas y dinámicas.</p>
                </div>
              </div>

              <div className="mode-distribution">
                {modeDistribution.map((item) => (
                  <div className="mode-distribution-item" key={item.label}>
                    <div>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                    <div className="mode-progress-track">
                      <div
                        className="mode-progress-fill"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <small>{item.percentage.toFixed(1)}%</small>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="panel statistics-table-panel">
            <div className="panel-heading">
              <div>
                <h3>Sesiones recientes</h3>
                <p>Últimas sesiones almacenadas para tu usuario.</p>
              </div>
            </div>

            <div className="statistics-table-wrap">
              <table className="statistics-table">
                <thead>
                  <tr>
                    <th>Sesión</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Modo</th>
                    <th>Predicciones</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sessions.slice(0, 10).map((session) => (
                    <tr key={session.id}>
                      <td>#{session.id}</td>
                      <td>{formatDate(session.started_at)}</td>
                      <td>{formatDate(session.ended_at)}</td>
                      <td>
                        <span className="statistics-mode-badge">
                          {session.mode || "hybrid"}
                        </span>
                      </td>
                      <td>{session.total_predictions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Statistics;
