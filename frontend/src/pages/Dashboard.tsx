import StatCard from "../components/StatCard";

function Dashboard() {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2>Panel principal</h2>
          <p>
            Resumen general del sistema de traducción.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Traducciones"
          value="128"
          description="Total registradas"
         
          //ojito xd
        />

        <StatCard
          title="Atenciones"
          value="24"
          description="Sesiones realizadas"
          icon="◉"
        />

        <StatCard
          title="Confianza promedio"
          value="87%"
          description="Reconocimiento"
          icon="✓"
        />

        <StatCard
          title="Plantillas"
          value="8"
          description="Respuestas rápidas"
          icon="▤"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Actividad reciente</h3>
              <p>Resumen de traducciones</p>
            </div>
          </div>

          <div className="activity-placeholder">
            <span>📊</span>
            <strong>Estadísticas del sistema</strong>
            <p>
              Aquí se mostrarán los datos obtenidos
              durante las atenciones.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Señas frecuentes</h3>
              <p>Ranking demostrativo</p>
            </div>
          </div>

          <div className="ranking">
            <div>
              <span>1</span>
              <strong>A</strong>
              <small>42 reconocimientos</small>
            </div>

            <div>
              <span>2</span>
              <strong>E</strong>
              <small>38 reconocimientos</small>
            </div>

            <div>
              <span>3</span>
              <strong>M</strong>
              <small>31 reconocimientos</small>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;