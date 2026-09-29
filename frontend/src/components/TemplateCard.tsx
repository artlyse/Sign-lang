interface TemplateCardProps {
  title: string;
  text: string;
  category: string;
  onUse: (text: string) => void;
}

function TemplateCard({
  title,
  text,
  category,
  onUse,
}: TemplateCardProps) {
  return (
    <article className="template-card">
      <div className="template-header">
        <span>{category}</span>
      </div>

      <h3>{title}</h3>

      <p>{text}</p>

      <button onClick={() => onUse(text)}>
        Usar plantilla
      </button>
    </article>
  );
}

export default TemplateCard;