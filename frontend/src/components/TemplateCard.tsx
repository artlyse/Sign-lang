import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, CheckCircle2, Copy, Globe2, Languages, Lock, Pencil, Trash2, Volume2 } from "lucide-react";
import type { Template } from "../services/templates";
import { isMine } from "../services/templates";

interface TemplateCardProps {
  template: Template;
  icon: LucideIcon;
  tone: string;
  selectedPhrase?: string | null;
  onSelectPhrase: (template: Template, phrase: string) => void;
  onSpeak?: (phrase: string) => void;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
  active?: boolean;
  onActivate?: (template: Template) => void;
}

/** Tarjeta de un paquete de frases: cada frase se puede escuchar o copiar. */
function TemplateCard({
  template,
  icon: Icon,
  tone,
  selectedPhrase,
  onSelectPhrase,
  onSpeak,
  onEdit,
  onDelete,
  active = false,
  onActivate,
}: TemplateCardProps) {
  const [copied, setCopied] = useState<number | null>(null);
  const mine = isMine(template);

  const copy = async (phrase: string, index: number) => {
    try {
      await navigator.clipboard.writeText(phrase);
      setCopied(index);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      /* portapapeles no disponible */
    }
  };

  return (
    <article className={`template-card pack-card tone-${tone} ${active ? "active" : ""}`}>
      <div className="template-header">
        <span className="template-icon">
          <Icon size={20} />
        </span>
        <div className="template-header-right">
          <span className="template-category">{template.category}</span>
          <span
            className={`pack-owner ${mine ? "mine" : ""}`}
            title={template.shared ? "Visible para la comunidad" : "Solo visible para ti"}
          >
            {template.shared ? <Globe2 size={13} /> : <Lock size={13} />}
            {mine ? "Mía" : template.author ?? "Comunidad"}
          </span>
        </div>
      </div>

      <h3>{template.name}</h3>
      {template.description && <p className="pack-description">{template.description}</p>}

      <ul className="pack-phrases">
        {template.phrases.map((phrase, index) => (
          <li key={`${index}-${phrase}`} className={selectedPhrase === phrase ? "selected" : ""}>
            <button
              type="button"
              className="pack-phrase-text"
              onClick={() => onSelectPhrase(template, phrase)}
              title="Seleccionar frase"
            >
              {phrase.split(/(\{\s*nombre\s*\})/i).map((part, i) =>
                /^\{\s*nombre\s*\}$/i.test(part) ? (
                  <mark key={i} className="pack-name-token">tu nombre</mark>
                ) : (
                  part
                ),
              )}
            </button>
            {onSpeak && (
              <button
                type="button"
                className="pack-phrase-icon"
                onClick={() => onSpeak(phrase)}
                aria-label="Escuchar frase"
                title="Escuchar"
              >
                <Volume2 size={15} />
              </button>
            )}
            <button
              type="button"
              className={`pack-phrase-icon ${copied === index ? "done" : ""}`}
              onClick={() => copy(phrase, index)}
              aria-label="Copiar frase"
              title="Copiar"
            >
              {copied === index ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </li>
        ))}
      </ul>

      {onActivate && (
        <button
          type="button"
          className={`pack-activate ${active ? "on" : ""}`}
          onClick={() => onActivate(template)}
        >
          {active ? <CheckCircle2 size={16} /> : <Languages size={16} />}
          {active ? "Activa en el Traductor" : "Usar en el Traductor"}
        </button>
      )}

      <div className="template-meta">
        <span className="pack-triggers" title="Palabras que activan la sugerencia en el Traductor">
          {template.triggers.length > 0
            ? template.triggers.slice(0, 6).map((t) => <i key={t}>{t}</i>)
            : "Sin disparadores"}
          {template.triggers.length > 6 && <i>+{template.triggers.length - 6}</i>}
        </span>
        {mine && (
          <span className="template-mini-actions">
            <button type="button" onClick={() => onEdit(template)} aria-label="Editar" title="Editar">
              <Pencil size={14} />
            </button>
            <button type="button" onClick={() => onDelete(template)} aria-label="Eliminar" title="Eliminar">
              <Trash2 size={14} />
            </button>
          </span>
        )}
      </div>
    </article>
  );
}

export default TemplateCard;
