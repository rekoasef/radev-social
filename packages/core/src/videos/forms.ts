// The ways of telling a story (ADR 0030). The Script office picks one and gives every scene a role
// ("beat"); the code checks that the form is followed (packages/video, forms.ts).

export const VIDEO_FORMS = ["cronologia", "misterio", "contraste", "despues"] as const;
export type VideoForm = (typeof VIDEO_FORMS)[number];

export const VIDEO_BEATS = [
  "gancho",
  "pregunta",
  "hecho",
  "pista",
  "hipotesis",
  "giro",
  "revelacion",
  "ladoA",
  "ladoB",
  "veredicto",
  "despues",
  "cierre",
  // The operator's opinion (ADR 0031): any form may carry it.
  "aporte",
] as const;
export type VideoBeat = (typeof VIDEO_BEATS)[number];

/** The roles each form uses. */
export const FORM_BEATS = {
  cronologia: ["gancho", "pregunta", "hecho", "cierre"],
  misterio: ["gancho", "pregunta", "pista", "hipotesis", "giro", "revelacion", "cierre"],
  contraste: ["gancho", "pregunta", "ladoA", "ladoB", "veredicto", "cierre"],
  despues: ["gancho", "pregunta", "hecho", "despues", "cierre"],
} as const satisfies Record<VideoForm, readonly VideoBeat[]>;

export const FORM_LABELS: Record<VideoForm, string> = {
  cronologia: "Cronología",
  misterio: "Misterio",
  contraste: "Contraste",
  despues: "Qué pasó después",
};

/** What each form is for, for the operator's choice. */
export const FORM_USES: Record<VideoForm, string> = {
  cronologia: "Un hecho con una secuencia clara, contado en orden.",
  misterio: "Algo sin explicar del todo: pistas y la respuesta al final.",
  contraste: "Lo que se creía y lo que se sabe, o dos versiones enfrentadas.",
  despues: "Un hecho famoso y qué fue después de cada protagonista.",
};

export const BEAT_LABELS: Record<VideoBeat, string> = {
  gancho: "Gancho",
  pregunta: "Pregunta",
  hecho: "Hecho",
  pista: "Pista",
  hipotesis: "Hipótesis",
  giro: "Giro",
  revelacion: "Revelación",
  ladoA: "Lado A",
  ladoB: "Lado B",
  veredicto: "Veredicto",
  despues: "Después",
  cierre: "Cierre",
  aporte: "Tu aporte",
};

/** The longest «tu aporte» the operator can write (ADR 0031). */
export const CONTRIBUTION_MAX = 500;
