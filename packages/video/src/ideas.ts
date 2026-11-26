import {
  VIDEO_IDEA_COUNT,
  VIDEO_IDEA_HOOK_MAX,
  VIDEO_IDEA_SOURCES_MAX,
  VIDEO_IDEA_TOPIC_MAX,
  VIDEO_IDEA_TOPIC_MIN,
  type VideoIdeaMode,
} from "@radev/core";
import { z } from "zod";

// Temas para "Nuevo video": formato de la respuesta e instrucciones (CLAUDE.md, regla 4).

const sourceSchema = z.object({
  title: z.string().trim().min(1).max(160),
  url: z.url({ protocol: /^https?$/, error: "Tiene que ser un link http(s)." }).max(500),
});

/** La respuesta de un pedido; con búsqueda, cada tema trae las páginas que leyó. */
export function videoIdeasSchema(mode: VideoIdeaMode) {
  const idea = z.object({
    topic: z.string().trim().min(VIDEO_IDEA_TOPIC_MIN).max(VIDEO_IDEA_TOPIC_MAX),
    hook: z.string().trim().min(1).max(VIDEO_IDEA_HOOK_MAX),
    ...(mode === "research" && {
      sources: z.array(sourceSchema).min(1).max(VIDEO_IDEA_SOURCES_MAX),
    }),
  });
  return z.object({ ideas: z.array(idea).min(1).max(VIDEO_IDEA_COUNT) });
}

export const IDEA_RULES = `# Buscador de temas para videos

Proponés temas para videos documentales cortos (~2 minutos): una voz en off cuenta una historia real sobre **imágenes de archivo libres** (Wikimedia Commons) y gráficos. Español rioplatense con voseo.

Un buen tema:
- Es **un hecho o una historia concreta y real**, con protagonista, lugar y época. No un tema amplio («la Guerra Fría») sino un episodio («el submarino soviético que no disparó en 1962»).
- Tiene gancho: algo que sorprende, una incógnita o un giro.
- Tiene **fuentes serias** para investigarlo.
- Tiene **imágenes libres probables**: fotos de época, retratos, lugares, documentos, diarios, mapas. Un tema sin material visual no sirve.
- No es difamatorio ni sensacionalista con personas vivas, ni una teoría conspirativa presentada como cierta.

Devolvé:
- \`topic\`: el tema como se lo contarías a un investigador, en una o dos frases: qué pasó, quién, dónde y cuándo, y qué querés contar. Es lo que se le manda a Investigación.
- \`hook\`: una frase corta sobre por qué engancha.

Los dos textos van **limpios y terminados**: nada de borradores, dudas, correcciones sobre la marcha («no, mejor…») ni comentarios tuyos. Si descartás un tema, no lo menciones.

No inventes datos, fechas ni cifras: si no estás seguro de un número, no lo pongas. Los hechos los verifica después la oficina de Investigación.

No repitas ni reformules ningún tema de \`ya-hechos.json\`. Que los temas sean distintos entre sí (épocas, lugares y tipos de historia variados, salvo que el enfoque pida otra cosa).
`;

export const IDEA_PROMPT =
  "Proponé temas según `task.json`, con lo que ya sabés. Leé antes `ya-hechos.json`. Devolvé solo el objeto que pide el schema.";

export const IDEA_RESEARCH_PROMPT =
  "Buscá en la web de qué se está hablando ahora (aniversarios, hallazgos, archivos desclasificados, noticias que traen de vuelta una historia) y traé temas según `task.json`. Leé antes `ya-hechos.json`. Lo actual es el disparador: el video cuenta una historia que ya tiene fotos, documentos o diarios libres. Un hallazgo de esta semana sin imágenes en Commons no sirve; la historia de fondo que ese hallazgo trae de vuelta, sí. Cada tema lleva en `sources` las páginas que leíste, nunca páginas inventadas, y preferí medios, museos, archivos y universidades antes que listas de efemérides. Devolvé solo el objeto que pide el schema.";
