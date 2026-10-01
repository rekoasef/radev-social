import type { BrandDocumentKind, PillarGoal } from "@radev/core";

// The brand's CLAUDE.md for a generation run (docs/ARCHITECTURE.md §7): who writes, how the brand
// talks, its limits, and the only figures it may use. Built from plain data (the worker loads it
// from brand_documents and content_pillars), so this package doesn't touch the database.

export type BrandContext = {
  name: string;
  /** Current version of each document the brand has. */
  documents: Partial<Record<BrandDocumentKind, string>>;
  /** Active pillars only (archived ones are left out by the caller). */
  pillars: readonly BrandPillar[];
  /** WhatsApp the `cta` points to, when the brand has one. */
  whatsappNumber?: string | null;
};

export type BrandPillar = {
  key: string;
  name: string;
  description: string;
  targetShare: number;
  /** How its posts are written (ADR 0021); every field may be empty. */
  goal?: PillarGoal | null;
  hookTypes?: readonly string[];
  guide?: string;
  closing?: string;
  avoid?: string;
};

const GOALS: Record<PillarGoal, string> = {
  reach:
    "alcance, que lo vea y lo guarde gente que no conoce la marca; la venta, como mucho, suave y al final",
  trust: "confianza, mostrar con hechos concretos que la marca sabe y cumple",
  sales: "venta, llevar a la acción del cierre con una sola razón clara",
};

/** A pillar's line, plus its guide below when it has one. */
function pillarLines(p: BrandPillar): string[] {
  const head = `- \`${p.key}\` — **${p.name}** (${percent(p.targetShare)})${p.description ? `: ${p.description}` : ""}`;
  const details = [
    p.goal && `Objetivo: ${GOALS[p.goal]}.`,
    p.hookTypes &&
      p.hookTypes.length > 0 &&
      `Ganchos preferidos: ${p.hookTypes.map((h) => `\`${h}\``).join(", ")} (si \`task.json\` no fija otro).`,
    p.guide?.trim() && `Cómo se cuenta: ${p.guide.trim()}`,
    p.closing?.trim() && `Cómo cierra: ${p.closing.trim()}`,
    p.avoid?.trim() && `Evitar: ${p.avoid.trim()}`,
  ].filter((line): line is string => Boolean(line));
  return [head, ...details.map((line) => `  - ${line.replace(/\s*\n\s*/g, " ")}`)];
}

const SECTIONS: { kind: BrandDocumentKind; title: string; lead: string }[] = [
  {
    kind: "voice",
    title: "Voz de la marca",
    lead: "Cómo habla la marca. Respetala en cada texto.",
  },
  {
    kind: "rules",
    title: "Reglas",
    lead: "Límites que no se cruzan. Si una idea choca con una regla, gana la regla.",
  },
  {
    kind: "pricing",
    title: "Precios",
    lead: "Las únicas cifras de precios que podés usar. Si un número no está acá, no lo pongas.",
  },
  {
    kind: "cases",
    title: "Casos",
    lead: "Proyectos y resultados reales. No agregues casos ni resultados que no estén acá.",
  },
];

/** A document's headings go below its `##` section: `#` → `###`, `##` → `####` (h6 at most). */
const nest = (markdown: string) =>
  markdown
    .trim()
    .replace(
      /^(#{1,6}) /gm,
      (_, hashes: string) => `${"#".repeat(Math.min(6, hashes.length + 2))} `,
    );

const percent = (share: number) => `${Math.round(share * 100)} %`;

export function buildBrandClaudeMd(brand: BrandContext): string {
  const parts: string[] = [
    `# ${brand.name} — redacción de contenido`,
    [
      `Escribís carruseles para las redes de ${brand.name}. Todo en español rioplatense (voseo), salvo que la voz de la marca diga otra cosa.`,
      "",
      "Reglas de trabajo:",
      "- **Nunca inventes números**: precios, porcentajes, cantidades ni resultados. Solo usá los de este archivo o los de los archivos de la tarea (`data.json`). Si hace falta una cifra que no tenés, reformulá sin cifra.",
      "- La tarea está en `task.json`. Si hay otros archivos (`recent-posts.json`, `winners.json`, `data.json`), leelos antes de escribir.",
      "- La respuesta es solo el objeto pedido, con el formato exacto del schema. Sin texto antes ni después.",
    ].join("\n"),
  ];

  for (const section of SECTIONS) {
    const content = brand.documents[section.kind]?.trim();
    if (!content) continue;
    parts.push(`## ${section.title}\n\n${section.lead}\n\n${nest(content)}`);
  }

  const { pillars } = brand;
  if (pillars.length > 0) {
    parts.push(
      [
        "## Pilares de contenido",
        "",
        "Cada post pertenece a uno (`pillarKey`). Entre paréntesis, la parte de los posts que le toca. Si un pilar dice cómo se escribe, seguilo en sus posts: objetivo, ganchos, cómo se cuenta, cómo cierra y qué evitar.",
        "",
        ...pillars.flatMap(pillarLines),
      ].join("\n"),
    );
  }

  if (brand.whatsappNumber) {
    parts.push(
      `## Contacto\n\nEl cierre (\`cta\`) invita a escribir por WhatsApp: el botón dice la acción (por ejemplo "Escribime por WhatsApp"), nunca el número.`,
    );
  }

  return `${parts.join("\n\n")}\n`;
}
