import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  Medal,
  BarChart3,
  Clock,
  Gauge,
  Inbox,
  LayoutTemplate,
  ScanLine,
  Target,
  Trophy,
  Waves,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import StatCard from "../components/StatCard";
import HandIllustration from "../components/HandIllustration";
import { getPracticeProgress } from "../services/practice";
import type { PracticeProgress } from "../services/practice";
import { getTrainingStats } from "../services/training";
import type { TrainingStats } from "../services/training";
import { getLearningStats } from "../services/learning";
import type { LearningStats } from "../services/learning";
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

type QuickPage = "translator" | "practice" | "templates" | "statistics";

interface DashboardProps {
  displayName?: string;
  onNavigate?: (page: QuickPage) => void;
}

const QUICK_ACTIONS: {
  page: QuickPage;
  title: string;
  text: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  { page: "translator", title: "Traducir", text: "Abre la cámara y reconoce señas", icon: ScanLine, tone: "blue" },
  { page: "practice", title: "Practicar", text: "Mejora tu precisión con retos", icon: Target, tone: "violet" },
  { page: "templates", title: "Plantillas", text: "Mensajes rápidos de atención", icon: LayoutTemplate, tone: "green" },
  { page: "statistics", title: "Estadísticas", text: "Analiza tu progreso", icon: BarChart3, tone: "orange" },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function Dashboard({ displayName, onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<RecognitionStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [practice, setPractice] = useState<PracticeProgress | null>(null);
  const [training, setTraining] = useState<TrainingStats | null>(null);
  const [learning, setLearning] = useState<LearningStats | null>(null);

  useEffect(() => {
    getPracticeProgress().then((r) => setPractice(r.progress)).catch(console.warn);
    getTrainingStats().then(setTraining).catch(console.warn);
    getLearningStats().then(setLearning).catch(console.warn);
  }, []);

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
      <section className="dashboard-hero">
        <div className="dashboard-hero-text">
          <span className="hero-badge">
            <Zap size={14} /> Reconocimiento LSP con IA
          </span>
          <h2>
            {greeting()}
            {displayName ? `, ${displayName.split(" ")[0]}` : ""} 👋
          </h2>
          <p>
            Traduce señas en tiempo real, practica y revisa tu progreso
            desde un solo lugar.
          </p>
          {onNavigate && (
            <button
              type="button"
              className="hero-cta"
              onClick={() => onNavigate("translator")}
            >
              <ScanLine size={18} /> Iniciar traductor
              <ArrowRight size={16} />
            </button>
          )}
        </div>
        <div className="dashboard-hero-art">
          <HandIllustration />
        </div>
      </section>

      {error && <div className="statistics-state error">{error}</div>}

      <div className="stats-grid">
        <StatCard
          title="Reconocimientos"
          value={loading ? "—" : stats.totalPredictions}
          description="Predicciones registradas"
          icon={<ScanLine size={22} />}
          tone="blue"
        />
        <StatCard
          title="Atenciones"
          value={loading ? "—" : stats.totalSessions}
          description="Sesiones recientes"
          icon={<Activity size={22} />}
          tone="violet"
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
          icon={<Gauge size={22} />}
          tone="green"
        />
        <StatCard
          title="Dinámicas"
          value={loading ? "—" : stats.dynamicPredictions}
          description="Predicciones dinámicas"
          icon={<Waves size={22} />}
          tone="orange"
        />
      </div>

      <div className="progress-strip">
        <button type="button" className="progress-card tone-violet" onClick={() => onNavigate?.("practice")}>
          <span className="quick-action-icon"><Medal size={20} /></span>
          <div>
            <small>Práctica</small>
            <strong>Nivel {practice?.level ?? "—"}</strong>
            <div className="ranking-bar">
              <i style={{ width: `${Math.min(practice?.level_progress ?? 0, 100)}%` }} />
            </div>
            <em>
              {practice
                ? `${practice.level_xp}/${practice.next_level_xp} XP · racha ${practice.current_streak}`
                : "Cargando..."}
            </em>
          </div>
        </button>

        <button type="button" className="progress-card tone-blue" onClick={() => onNavigate?.("practice")}>
          <span className="quick-action-icon"><BrainCircuit size={20} /></span>
          <div>
            <small>Modelo personal</small>
            <strong>
              {training
                ? `${training.personal_model.active_labels.length} ${training.personal_model.active_labels.length === 1 ? "letra aprendida" : "letras aprendidas"}`
                : "—"}
            </strong>
            <em>
              {training
                ? `${training.verified} muestras verificadas · ${training.total - training.verified} pendientes`
                : "Cargando..."}
            </em>
          </div>
        </button>

        <div className="progress-card tone-green">
          <span className="quick-action-icon"><BookOpenCheck size={20} /></span>
          <div>
            <small>Corrector de palabras</small>
            <strong>
              {learning?.memory
                ? `${learning.memory.personal_words} ${learning.memory.personal_words === 1 ? "palabra aprendida" : "palabras aprendidas"}`
                : "—"}
            </strong>
            <em>
              {learning?.memory
                ? `${learning.memory.learned_exact_correction_pairs} correcciones · ${learning.memory.feedback_count} ejemplos`
                : "Cargando..."}
            </em>
          </div>
        </div>
      </div>

      {onNavigate && (
        <div className="quick-actions">
          {QUICK_ACTIONS.map(({ page, title, text, icon: Icon, tone }) => (
            <button
              type="button"
              key={page}
              className={`quick-action tone-${tone}`}
              onClick={() => onNavigate(page)}
            >
              <span className="quick-action-icon">
                <Icon size={20} />
              </span>
              <span className="quick-action-text">
                <strong>{title}</strong>
                <small>{text}</small>
              </span>
              <ArrowRight size={16} className="quick-action-arrow" />
            </button>
          ))}
        </div>
      )}

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <span className="panel-icon tone-blue">
              <Clock size={18} />
            </span>
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
                    <strong>
                      {prediction.mode === "dynamic" ? (
                        <><Waves size={13} /> Dinámica</>
                      ) : (
                        <><ScanLine size={13} /> Estática</>
                      )}
                    </strong>
                    <span>{formatRecentDate(prediction.created_at)}</span>
                  </div>
                  <small>{(Number(prediction.confidence || 0) * 100).toFixed(0)}%</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="activity-placeholder">
              <span className="empty-icon">
                <Inbox size={28} />
              </span>
              <strong>Sin actividad registrada</strong>
              <p>Las predicciones aparecerán aquí después de usar el Traductor.</p>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <span className="panel-icon tone-orange">
              <Trophy size={18} />
            </span>
            <div>
              <h3>Señas frecuentes</h3>
              <p>Ranking de tu actividad.</p>
            </div>
          </div>

          {stats.topRecognitions.length > 0 ? (
            <div className="ranking">
              {stats.topRecognitions.slice(0, 5).map((item, index) => (
                <div key={item.text} className={index < 3 ? `top-${index + 1}` : ""}>
                  <span>{index + 1}</span>
                  <strong>{item.text}</strong>
                  <div className="ranking-meta">
                    <small>{item.count} reconocimientos</small>
                    <div className="ranking-bar">
                      <i style={{ width: `${Math.max(item.percentage, 4)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="activity-placeholder compact">
              <span className="empty-icon">
                <Trophy size={26} />
              </span>
              <p>Aún no hay datos para el ranking.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
