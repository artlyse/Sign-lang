function Help() {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2>Centro de ayuda</h2>
          <p>
            Información para utilizar correctamente
            el traductor.
          </p>
        </div>
      </div>

      <div className="help-grid">
        <section className="panel">
          <h3>Reconocimiento de señas</h3>

          <ol>
            <li>Ubícate frente a la cámara.</li>
            <li>Mantén las manos visibles.</li>
            <li>Realiza la seña claramente.</li>
            <li>Espera el resultado.</li>
            <li>Agrega la letra al mensaje.</li>
          </ol>
        </section>

        <section className="panel">
          <h3>🎙 Reconocimiento de voz</h3>

          <p>
            Permite al personal hablar para convertir
            su respuesta en texto.
          </p>
        </section>

        <section className="panel">
          <h3>📷 Cámara</h3>

          <p>
            Verifica que el navegador tenga permisos
            para utilizar la cámara.
          </p>
        </section>

        <section className="panel">
          <h3>💬 Plantillas</h3>

          <p>
            Utiliza respuestas frecuentes para agilizar
            la atención al usuario.
          </p>
        </section>
      </div>
    </div>
  );
}

export default Help;