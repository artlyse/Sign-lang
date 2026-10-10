import { useEffect, useState } from "react";
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

function formatRecentDate(value: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Dashboard() {
  const [stats, setStats] = useState<RecognitionStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setStats(await loadRecognitionStatistics(10));
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar el resumen del sistema.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2>Panel principal</h2>
          <p>Resumen de tu actividad reciente en Sign-lang.</p>
        </div>
      </div>

      {error && <div className="statistics-state error">{error}</div>}

      <div className="stats-grid">
        <StatCard
          title="Reconocimientos"
          value={loading ? "—" : stats.totalPredictions}
          description="Predicciones registradas"
          icon="▦"
        />
        <StatCard
          title="Atenciones"
          value={loading ? "—" : stats.totalSessions}
          description="Sesiones recientes"
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
          description="Reconocimiento almacenado"
          icon="✓"
        />
        <StatCard
          title="Dinámicas"
          value={loading ? "—" : stats.dynamicPredictions}
          description="Predicciones dinámicas"
          icon="↝"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Actividad reciente</h3>
              <p>Últimas predicciones guardadas.</p>
            </div>
          </div>

          {loading ? (
            <div className="activity-placeholder">
              <strong>Cargando actividad...</strong>
            </div>
          ) : stats.recentPredictions.length > 0 ? (
            <div className="recent-activity-list">
              {stats.recentPredictions.slice(0, 6).map((prediction) => (
                <div className="recent-activity-item" key={prediction.id}>
                  <div className="recent-activity-symbol">
                    {prediction.text || "-"}
                  </div>
                  <div>
                    <strong>{prediction.mode === "dynamic" ? "Dinámica" : "Estática"}</strong>
                    <span>{formatRecentDate(prediction.created_at)}</span>
                  </div>
                  <small>{(Number(prediction.confidence || 0) * 100).toFixed(0)}%</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="activity-placeholder">
              <strong>Sin actividad registrada</strong>
              <p>Las predicciones aparecerán aquí después de usar el Traductor.</p>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Señas frecuentes</h3>
              <p>Ranking de tu actividad.</p>
            </div>
          </div>

          {stats.topRecognitions.length > 0 ? (
            <div className="ranking">
              {stats.topRecognitions.slice(0, 5).map((item, index) => (
                <div key={item.text}>
                  <span>{index + 1}</span>
                  <strong>{item.text}</strong>
                  <small>{item.count} reconocimientos</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="statistics-empty">Aún no hay datos para el ranking.</div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
