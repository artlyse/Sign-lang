import { useState } from "react";
import TemplateCard from "../components/TemplateCard";

const templates = [
  {
    title: "Saludo",
    category: "General",
    text: "Buenos días, ¿en qué podemos ayudarle?",
  },
  {
    title: "Documento",
    category: "Trámite",
    text: "Por favor, presente su documento de identidad.",
  },
  {
    title: "Espera",
    category: "General",
    text: "Por favor, espere un momento mientras revisamos su solicitud.",
  },
  {
    title: "Despedida",
    category: "General",
    text: "Gracias por su visita. Que tenga un buen día.",
  },
];

function Templates() {
  const [selectedText, setSelectedText] = useState("");

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h2>Plantillas rápidas</h2>
          <p>
            Mensajes frecuentes para facilitar la atención.
          </p>
        </div>
      </div>

      <div className="templates-grid">
        {templates.map((template) => (
          <TemplateCard
            key={template.title}
            {...template}
            onUse={setSelectedText}
          />
        ))}
      </div>

      {selectedText && (
        <section className="panel selected-template">
          <span>Plantilla seleccionada</span>
          <p>{selectedText}</p>
        </section>
      )}
    </div>
  );
}

export default Templates;