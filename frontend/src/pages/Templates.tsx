import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  GraduationCap,
  HeartPulse,
  LayoutGrid,
  MessageSquareText,
  Plus,
  Search,
  Smile,
  Square,
  Tag,
  Volume2,
  X,
} from "lucide-react";
import TemplateCard from "../components/TemplateCard";
import useTextToSpeech from "../hooks/useTextToSpeech";
import "../styles/templates-packs.css";
import { getActiveTemplateId, setActiveTemplateId } from "../services/preferences";
import {
  TEMPLATE_CATEGORIES,
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate,
} from "../services/templates";
import type {
  Template,
  TemplateCategory,
  TemplateInput,
  TemplateScope,
} from "../services/templates";

const CATEGORY_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  Negocio: { icon: Briefcase, tone: "violet" },
  General: { icon: Smile, tone: "blue" },
  Educación: { icon: GraduationCap, tone: "orange" },
  Salud: { icon: HeartPulse, tone: "pink" },
  Personalizada: { icon: Tag, tone: "cyan" },
};

const styleFor = (category: string) =>
  CATEGORY_STYLE[category] ?? { icon: Tag, tone: "cyan" };

const SCOPES: { value: TemplateScope; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "mine", label: "Mis plantillas" },
  { value: "shared", label: "Comunidad" },
];

type FormState = {
  name: string;
  category: TemplateCategory;
  description: string;
  phrasesText: string;
  triggersText: string;
  shared: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  category: "Personalizada",
  description: "",
  phrasesText: "",
  triggersText: "",
  shared: true,
};

const toInput = (form: FormState): TemplateInput => ({
  name: form.name.trim(),
  category: form.category,
  description: form.description.trim(),
  phrases: form.phrasesText.split("\n").map((p) => p.trim()).filter(Boolean),
  triggers: form.triggersText.split(",").map((t) => t.trim()).filter(Boolean),
  shared: form.shared,
});

type TemplatesProps = {
  /** Lleva al Traductor después de elegir una plantilla. */
  onOpenTranslator?: () => void;
};

function Templates({ onOpenTranslator }: TemplatesProps = {}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [scope, setScope] = useState<TemplateScope>("all");
  const [category, setCategory] = useState("Todas");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ template: Template; phrase: string } | null>(null);

  const [editing, setEditing] = useState<Template | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState(() => getActiveTemplateId());

  const activate = (template: Template) => {
    const next = activeId === template.id ? "all" : template.id;
    setActiveId(next);
    setActiveTemplateId(next);
    if (next !== "all") onOpenTranslator?.();
  };

  const { supported, isSpeaking, speak, stop } = useTextToSpeech();

  const load = useCallback((nextScope: TemplateScope) => {
    setLoading(true);
    listTemplates(nextScope)
      .then((items) => {
        setTemplates(items);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudieron cargar las plantillas."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(scope);
  }, [scope, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter(
      (t) =>
        (category === "Todas" || t.category === category) &&
        (!q ||
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.phrases.some((p) => p.toLowerCase().includes(q)) ||
          t.triggers.some((p) => p.toLowerCase().includes(q))),
    );
  }, [templates, query, category]);

  const countFor = (cat: string) =>
    cat === "Todas" ? templates.length : templates.filter((t) => t.category === cat).length;

  const handleDelete = async (template: Template) => {
    if (!window.confirm(`¿Eliminar el paquete "${template.name}"? Esta acción no se puede deshacer.`))
      return;
    try {
      await deleteTemplate(template.id);
      setTemplates((list) => list.filter((t) => t.id !== template.id));
      if (selected?.template.id === template.id) setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  const openForm = (template?: Template) => {
    setEditing(template ?? null);
    setForm(
      template
        ? {
            name: template.name,
            category: (TEMPLATE_CATEGORIES as readonly string[]).includes(template.category)
              ? (template.category as TemplateCategory)
              : "Personalizada",
            description: template.description,
            phrasesText: template.phrases.join("\n"),
            triggersText: template.triggers.join(", "),
            shared: template.shared,
          }
        : {
            ...EMPTY_FORM,
            category: (TEMPLATE_CATEGORIES as readonly string[]).includes(category)
              ? (category as TemplateCategory)
              : "Personalizada",
          },
    );
    setFormOpen(true);
    setError("");
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    const payload = toInput(form);
    if (payload.phrases.length === 0) {
      setError("Agrega al menos una frase (una por línea).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        const saved = await updateTemplate(editing.id, payload);
        setTemplates((list) => list.map((t) => (t.id === saved.id ? saved : t)));
      } else {
        const created = await createTemplate(payload);
        setTemplates((list) => [created, ...list]);
      }
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const phraseCount = toInput(form).phrases.length;

  return (
    <div className="page">
      <div className="page-heading templates-heading">
        <div>
          <h2>Plantillas de frases</h2>
          <p>
            Elige una plantilla con <strong>Usar en el Traductor</strong>: mientras señas, la
            Conversación te sugerirá sus frases. Escribe <code>{"{nombre}"}</code> para que se
            complete con tu nombre al reconocer tu rostro.
          </p>
        </div>

        <div className="templates-toolbar">
          <div className="templates-search">
            <Search size={18} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar frase o paquete..."
            />
          </div>
          <button type="button" className="templates-new" onClick={() => openForm()}>
            <Plus size={18} /> Nuevo paquete
          </button>
        </div>
      </div>

      <div className="templates-scope" role="tablist" aria-label="Origen de las plantillas">
        {SCOPES.map((item) => (
          <button
            type="button"
            role="tab"
            aria-selected={scope === item.value}
            key={item.value}
            className={scope === item.value ? "active" : ""}
            onClick={() => setScope(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="templates-filters">
        {["Todas", ...TEMPLATE_CATEGORIES].map((cat) => (
          <button
            type="button"
            key={cat}
            className={cat === category ? "active" : ""}
            onClick={() => setCategory(cat)}
          >
            {cat === "Todas" && <LayoutGrid size={15} />}
            {cat}
            <span>{countFor(cat)}</span>
          </button>
        ))}
      </div>

      {error && <div className="statistics-state error">{error}</div>}

      {formOpen && (
        <form className="panel template-form" onSubmit={submitForm}>
          <div className="template-form-head">
            <h3>{editing ? "Editar paquete" : "Nuevo paquete de frases"}</h3>
            <button
              type="button"
              className="icon-ghost"
              onClick={() => setFormOpen(false)}
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
          <div className="template-form-row">
            <label>
              Nombre
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                minLength={2}
                maxLength={100}
                placeholder="Ej. Atención en farmacia"
                required
              />
            </label>
            <label>
              Categoría
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as TemplateCategory })}
              >
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Descripción
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={500}
              placeholder="¿Para qué situación sirve este paquete?"
            />
          </label>
          <label>
            Frases <small>(una por línea · {phraseCount}/100 · escribe {"{nombre}"} para insertar tu nombre)</small>
            <textarea
              value={form.phrasesText}
              onChange={(e) => setForm({ ...form, phrasesText: e.target.value })}
              rows={5}
              placeholder={"¡Hola! Me llamo {nombre}.\n¿Dónde queda la farmacia?"}
              required
            />
          </label>
          <label>
            Palabras disparadoras <small>(separadas por comas)</small>
            <input
              value={form.triggersText}
              onChange={(e) => setForm({ ...form, triggersText: e.target.value })}
              placeholder="hola, precio, ayuda"
            />
          </label>
          <label className="template-form-check">
            <input
              type="checkbox"
              checked={form.shared}
              onChange={(e) => setForm({ ...form, shared: e.target.checked })}
            />
            Compartir con las demás cuentas (desmárcalo para que sea solo tuya)
          </label>
          <div className="template-form-actions">
            <button
              type="button"
              className="secondary-action-button"
              onClick={() => setFormOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="templates-new" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      )}

      {selected && (
        <section className="selected-template">
          <span className="selected-template-icon">
            <MessageSquareText size={22} />
          </span>
          <div className="selected-template-body">
            <span>{selected.template.name}</span>
            <p>{selected.phrase}</p>
          </div>
          <div className="selected-template-actions">
            {supported && (
              <button
                type="button"
                onClick={() => (isSpeaking ? stop() : speak(selected.phrase))}
              >
                {isSpeaking ? <Square size={16} /> : <Volume2 size={16} />}
                {isSpeaking ? "Detener" : "Escuchar"}
              </button>
            )}
            <button
              type="button"
              className="ghost"
              onClick={() => setSelected(null)}
              aria-label="Quitar selección"
            >
              <X size={16} />
            </button>
          </div>
        </section>
      )}

      {loading ? (
        <div className="panel activity-placeholder">
          <strong>Cargando plantillas...</strong>
        </div>
      ) : filtered.length > 0 ? (
        <div className="templates-grid">
          {filtered.map((template) => {
            const { icon, tone } = styleFor(template.category);
            return (
              <TemplateCard
                key={template.id}
                template={template}
                icon={icon}
                tone={tone}
                selectedPhrase={
                  selected?.template.id === template.id ? selected.phrase : null
                }
                onSelectPhrase={(t, phrase) => setSelected({ template: t, phrase })}
                onSpeak={supported ? (phrase) => speak(phrase) : undefined}
                onEdit={openForm}
                onDelete={handleDelete}
                active={activeId === template.id}
                onActivate={activate}
              />
            );
          })}
        </div>
      ) : (
        <div className="panel activity-placeholder">
          <span className="empty-icon">
            <Search size={26} />
          </span>
          <strong>Sin resultados</strong>
          <p>
            {query
              ? `No hay paquetes que coincidan con “${query}”.`
              : scope === "mine"
                ? "Aún no creaste paquetes. Usa “Nuevo paquete”."
                : "No hay paquetes en esta categoría."}
          </p>
        </div>
      )}
    </div>
  );
}

export default Templates;
