function Settings() {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2>Configuración</h2>
          <p>
            Personaliza el funcionamiento del sistema.
          </p>
        </div>
      </div>

      <section className="panel settings-panel">
        <div className="setting-row">
          <div>
            <strong>Mostrar landmarks</strong>
            <p>
              Mostrar los puntos detectados sobre las manos.
            </p>
          </div>

          <input type="checkbox" defaultChecked />
        </div>

        <div className="setting-row">
          <div>
            <strong>Idioma de voz</strong>
            <p>
              Idioma utilizado para reconocimiento y TTS.
            </p>
          </div>

          <select defaultValue="es-PE">
            <option value="es-PE">
              Español - Perú
            </option>

            <option value="es-ES">
              Español - España
            </option>

            <option value="en-US">
              Inglés
            </option>
          </select>
        </div>

        <div className="setting-row">
          <div>
            <strong>Confianza mínima</strong>
            <p>
              Nivel mínimo recomendado para aceptar una seña.
            </p>
          </div>

          <select defaultValue="80">
            <option value="70">70%</option>
            <option value="80">80%</option>
            <option value="90">90%</option>
          </select>
        </div>
      </section>
    </div>
  );
}

export default Settings;