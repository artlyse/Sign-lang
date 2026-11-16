/**
 * Paquetes de frases (plantillas) guardados en la base de datos.
 * Cada paquete tiene varias frases y palabras disparadoras que el Traductor
 * usa para sugerir respuestas al personal.
 */
import { apiJson } from "./api";

export const TEMPLATE_CATEGORIES = [
  "Negocio",
  "General",
  "Educación",
  "Salud",
  "Personalizada",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
export type TemplateScope = "all" | "mine" | "shared";

export type Template = {
  id: string;
  name: string;
  category: string;
  description: string;
  phrases: string[];
  triggers: string[];
  owner: "Mi cuenta" | "Comunidad" | string;
  /** Nombre de quien creó la plantilla ("Sistema" para las predefinidas). */
  author?: string;
  shared: boolean;
  updatedAt: string | null;
};

export type TemplateInput = {
  name: string;
  category: TemplateCategory;
  description: string;
  phrases: string[];
  triggers: string[];
  shared: boolean;
};

export const isMine = (template: Template) => template.owner === "Mi cuenta";

export const listTemplates = (scope: TemplateScope = "all") =>
  apiJson<{ items: Template[] }>(`/api/templates?scope=${scope}`).then((r) => r.items);

export const createTemplate = (data: TemplateInput) =>
  apiJson<Template>("/api/templates", { method: "POST", json: data });

export const updateTemplate = (id: string, data: TemplateInput) =>
  apiJson<Template>(`/api/templates/${id}`, { method: "PUT", json: data });

export const deleteTemplate = (id: string) =>
  apiJson<void>(`/api/templates/${id}`, { method: "DELETE" });

/** Quita tildes y signos para comparar palabras disparadoras. */
export const normalizeWord = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-zñ0-9\s]/g, " ")
    .trim();

/**
 * Devuelve los paquetes cuyas palabras disparadoras aparecen en el texto,
 * ordenados por cantidad de coincidencias.
 */
export function matchTemplates(text: string, templates: Template[]) {
  const words = new Set(normalizeWord(text).split(/\s+/).filter(Boolean));
  if (words.size === 0) return [];

  return templates
    .map((template) => {
      const hits = template.triggers.filter((trigger) => {
        const t = normalizeWord(trigger);
        return t.includes(" ") ? normalizeWord(text).includes(t) : words.has(t);
      });
      return { template, hits };
    })
    .filter((item) => item.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length);
}


/* ------------------------------------------------------------------ */
/* Frases sugeridas en la Conversación del Traductor                    */
/* ------------------------------------------------------------------ */

/** Marcador que se reemplaza por el nombre de la persona. */
export const NAME_TOKEN = /\{\s*nombre\s*\}/gi;

export const needsName = (phrase: string) => /\{\s*nombre\s*\}/i.test(phrase);

/** Reemplaza {nombre}; si no hay nombre, devuelve null (la frase no aplica aún). */
export function fillName(phrase: string, name: string | null | undefined) {
  if (!needsName(phrase)) return phrase;
  const clean = (name ?? "").trim();
  if (!clean) return null;
  const pretty = clean
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase());
  return phrase.replace(NAME_TOKEN, pretty);
}

export type PhraseSuggestion = {
  /** Texto final, ya con el nombre. */
  text: string;
  /** Paquete de origen. */
  pack: string;
  /** true si la frase contiene todo lo señado y debe reemplazarlo. */
  replace: boolean;
  personalized: boolean;
};

/**
 * Sugiere frases de las plantillas según lo que se lleva señado.
 * - Sin nada señado: primeras frases de la plantilla activa.
 * - Con palabras: frases que contienen esas palabras (prioriza las que empiezan
 *   igual) y frases de paquetes cuyos disparadores aparecen.
 */
export function suggestPhrases(
  signedText: string,
  templates: Template[],
  name: string | null,
  limit = 5,
): PhraseSuggestion[] {
  const signed = normalizeWord(signedText).split(/\s+/).filter(Boolean);
  const results: (PhraseSuggestion & { score: number })[] = [];
  const seen = new Set<string>();

  for (const template of templates) {
    const triggerHit = template.triggers.some((t) => signed.includes(normalizeWord(t)));

    template.phrases.forEach((phrase, order) => {
      const text = fillName(phrase, name);
      if (!text || seen.has(text)) return;

      const words = normalizeWord(text).split(/\s+/).filter(Boolean);
      let score = 0;

      if (signed.length === 0) {
        score = 10 - order + (needsName(phrase) ? 3 : 0);
      } else {
        const last = signed[signed.length - 1];
        const hits = signed.filter((w) => words.includes(w)).length;
        // palabra a medio deletrear: "HO" -> "hola"
        const partial = words.some((w) => w.startsWith(last) && w !== last) ? 1 : 0;
        if (hits === 0 && !partial && !triggerHit) return;
        score =
          hits * 4 +
          partial * 2 +
          (words[0] === signed[0] ? 5 : 0) +
          (triggerHit ? 1 : 0) +
          (needsName(phrase) ? 2 : 0) -
          order * 0.1;
      }

      const replace =
        signed.length > 0 &&
        signed.slice(0, -1).every((w) => words.includes(w)) &&
        (words.includes(signed[signed.length - 1]) ||
          words.some((w) => w.startsWith(signed[signed.length - 1])));

      seen.add(text);
      results.push({
        text,
        pack: template.name,
        replace,
        personalized: needsName(phrase),
        score,
      });
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...item }) => item);
}
