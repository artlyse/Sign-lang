function Help() {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2>Centro de ayuda</h2>
          <p>Guía rápida para utilizar las funciones principales del sistema.</p>
        </div>
      </div>

      <div className="help-grid">
        <section className="panel">
          <h3>Reconocimiento de señas</h3>
          <ol>
            <li>Permite el acceso a la cámara.</li>
            <li>Mantén una mano visible y centrada.</li>
            <li>Sostén la seña hasta que la predicción sea estable.</li>
            <li>Retira la mano para separar o finalizar una palabra.</li>
            <li>Revisa las sugerencias antes de continuar.</li>
          </ol>
        </section>

        <section className="panel">
          <h3>Corrección de palabras</h3>
          <p>
            El sistema combina diccionario, similitud y aprendizaje para proponer
            palabras más probables. Puedes elegir una sugerencia o escribir una
            corrección manual cuando sea necesario.
          </p>
        </section>

        <section className="panel">
          <h3>Corrección contextual con IA</h3>
          <p>
            Después de formar varias palabras, usa “Corregir oración con IA” para
            mejorar tildes, puntuación y coherencia sin modificar el reconocimiento
            de cámara.
          </p>
        </section>

        <section className="panel">
          <h3>Respuesta por voz</h3>
          <p>
            El personal puede usar el micrófono para convertir su respuesta hablada
            a texto y facilitar la comunicación con el usuario.
          </p>
        </section>

        <section className="panel">
          <h3>Estadísticas</h3>
          <p>
            Las estadísticas se construyen con las sesiones y predicciones guardadas
            en tu cuenta. Si no hay datos, primero usa el Traductor con sesión iniciada.
          </p>
        </section>

        <section className="panel">
          <h3>Problemas de cámara</h3>
          <p>
            Si no aparece video, revisa los permisos del navegador y prueba otra cámara
            desde el selector disponible dentro del Traductor.
          </p>
        </section>
      </div>
    </div>
  );
}

export default Help;
