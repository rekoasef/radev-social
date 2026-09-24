import type { BrandDocumentKind } from "@radev/core";

/** Names and guidance of each brand document, as the operator sees them. */
export const DOCUMENT_INFO: Record<BrandDocumentKind, { label: string; hint: string }> = {
  voice: {
    label: "Voz",
    hint: "Cómo habla la marca: a quién le habla, tono, pilares, qué decir y qué no. Es lo que más pesa al generar.",
  },
  pricing: {
    label: "Precios",
    hint: "Rangos de precios reales. La IA solo usa cifras que estén acá: nunca inventa números.",
  },
  cases: {
    label: "Casos",
    hint: "Proyectos y resultados reales que se pueden contar en los posts.",
  },
  rules: {
    label: "Reglas",
    hint: "Límites que no se cruzan: temas prohibidos, promesas que no se hacen, palabras a evitar.",
  },
};
