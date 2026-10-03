import StatCard from "../components/StatCard";

function Statistics() {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2>Estadísticas</h2>
          <p>
            Información general del uso del sistema.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Traducciones"
          value="128"
       
        />

        <StatCard
          title="Atenciones"
          value="24"
          icon="◉"
        />

        <StatCard
          title="Confianza"
          value="87%"
          icon="✓"
        />
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Ranking de señas</h3>
            <p>Datos demostrativos</p>
          </div>
        </div>

        <div className="ranking large">
          {[
            ["A", 42],
            ["E", 38],
            ["M", 31],
            ["S", 26],
            ["P", 19],
          ].map(([letter, count], index) => (
            <div key={letter}>
              <span>{index + 1}</span>

              <strong>{letter}</strong>

              <small>
                {count} reconocimientos
              </small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Statistics;
