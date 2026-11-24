// Prueba de video animado (V0-6 redefinida, 2026-11-24): el video sale de un GUION, escena por
// escena. Cada escena dice qué narra la voz, en qué escenario pasa, quién está, qué hace cada uno
// y qué textos aparecen. Los tiempos se enganchan a palabras de la voz (`{ word: "seis" }`), así
// que si cambia la voz, todo se reacomoda solo. En V1 este JSON lo escribiría `claude -p` (o el
// operador) y se validaría con Zod antes de renderizar.

/** Cuándo pasa algo: segundos desde el inicio de la escena, o una palabra de la voz. */
export type Cue =
  | number
  | {
      word: string;
      /** Si la palabra aparece varias veces (por defecto, la primera). */
      nth?: number;
      /** Inicio (por defecto) o fin de la palabra. */
      edge?: "start" | "end";
      /** Segundos a sumar (negativo: antes). */
      offset?: number;
    };

export type Outfit = "ladron" | "guardia" | "civil";

export type Action =
  | { do: "walk"; at: Cue; toX: number; speed?: number }
  | { do: "lookWatch"; at: Cue; until?: Cue }
  | { do: "scratchHead"; at: Cue; until?: Cue }
  | { do: "panic"; at: Cue; until?: Cue }
  | { do: "carry"; at: Cue }
  | { do: "pop"; at: Cue };

export type Actor = {
  id: string;
  outfit: Outfit;
  /** Posición de los pies en el escenario (1080×1920) y tamaño. */
  x: number;
  y: number;
  scale?: number;
  facing?: "left" | "right";
  /** Aparece recién en este momento (si no, está desde el principio). */
  enter?: Cue;
  actions?: Action[];
};

export type PropItem =
  | { kind: "calendar"; month: string; year: string; x: number; y: number; at: Cue; until?: Cue }
  | { kind: "moneyBag"; x: number; y: number; at: Cue; scale?: number }
  | { kind: "stopwatch"; x: number; y: number; at: Cue; spinUntil: Cue }
  | { kind: "question"; x: number; y: number; at: Cue; scale?: number };

export type Overlay =
  /** Caja de dato con rebote. `count` cuenta desde 0 hasta el número entre `at` y `countUntil`. */
  {
    kind: "dataBox";
    text: string;
    sub?: string;
    x: number;
    y: number;
    at: Cue;
    until?: Cue;
    count?: { to: number; until: Cue };
  };

export type Setting = "aeropuerto-noche" | "reloj-alarma";

export type GuionScene = {
  /** Índice de la escena en la voz de V0-3 (out/v0-3/manifest.json). */
  voice: number;
  narration: string;
  setting: Setting;
  /**
   * Cámara: puntos clave (zoom y centro del cuadro en el escenario) enganchados a la voz. Entre
   * dos puntos se mueve suave; antes del primero y después del último, se queda (con un leve
   * acercamiento para que nunca esté quieta).
   */
  camera: { at: Cue; zoom: number; x: number; y: number }[];
  actors: Actor[];
  props: PropItem[];
  overlays: Overlay[];
  /** Palabras de los subtítulos que van en caja (1–2 por frase). */
  highlight: string[];
  /** Titular de abajo, en mayúsculas; `*palabra*` va en rojo. Entra palabra por palabra. */
  headline?: { text: string; at: Cue };
};

/** Los seis entran en fila desde la izquierda, uno detrás del otro. */
const ladron = (i: number): Actor => ({
  id: `ladron-${i + 1}`,
  outfit: "ladron",
  x: -120 - i * 100,
  y: 1270,
  scale: 0.86 + (i % 3) * 0.04,
  facing: "right",
  enter: { word: "seis", offset: i * 0.25 },
  actions: [
    { do: "walk", at: { word: "seis", offset: i * 0.25 }, toX: 800 - i * 95, speed: 260 },
    // Los de adelante salen con las bolsas.
    ...(i < 3 ? [{ do: "carry", at: { word: "llevaron", offset: i * 0.12 } } as const] : []),
  ],
});

/** El guion de la prueba: las dos primeras escenas del texto de V0-3. */
export const guion: GuionScene[] = [
  {
    voice: 0,
    narration:
      "En diciembre de 1978, seis hombres entraron al aeropuerto JFK de Nueva York y se llevaron casi 6 millones de dólares.",
    setting: "aeropuerto-noche",
    camera: [
      { at: 0, zoom: 1.12, x: 540, y: 980 },
      { at: { word: "seis", offset: -0.2 }, zoom: 1.4, x: 520, y: 1010 },
      { at: { word: "llevaron" }, zoom: 1.4, x: 640, y: 1010 },
      { at: { word: "dólares", edge: "end" }, zoom: 1.5, x: 680, y: 1030 },
    ],
    actors: [
      {
        id: "guardia",
        outfit: "guardia",
        x: 990,
        y: 1255,
        scale: 0.85,
        facing: "left",
        actions: [{ do: "lookWatch", at: 0.6, until: { word: "seis" } }],
      },
      ...[0, 1, 2, 3, 4, 5].map(ladron),
    ],
    props: [
      {
        kind: "calendar",
        month: "DICIEMBRE",
        year: "1978",
        x: 540,
        y: 720,
        at: { word: "diciembre" },
        until: { word: "seis", offset: -0.3 },
      },
    ],
    overlays: [
      {
        kind: "dataBox",
        text: "US$ 6 MILLONES",
        sub: "EN UNA NOCHE",
        x: 540,
        y: 620,
        at: { word: "6" },
      },
    ],
    highlight: ["1978", "seis", "JFK", "millones"],
    headline: { text: "EL ROBO DEL *SIGLO*", at: { word: "seis" } },
  },
  {
    voice: 1,
    narration: "Tardaron 64 minutos. ¿Cómo lo hicieron?",
    setting: "reloj-alarma",
    camera: [
      { at: 0, zoom: 1.08, x: 540, y: 900 },
      { at: { word: "minutos", edge: "end" }, zoom: 1, x: 540, y: 960 },
    ],
    actors: [
      {
        id: "guardia",
        outfit: "guardia",
        x: 330,
        y: 1370,
        scale: 1.5,
        facing: "right",
        enter: { word: "cómo", offset: -0.25 },
        actions: [
          { do: "pop", at: { word: "cómo", offset: -0.25 } },
          { do: "scratchHead", at: { word: "cómo" } },
        ],
      },
    ],
    props: [
      { kind: "stopwatch", x: 580, y: 740, at: 0, spinUntil: { word: "minutos", edge: "end" } },
      { kind: "question", x: 560, y: 1150, at: { word: "hicieron" }, scale: 0.8 },
      { kind: "question", x: 140, y: 960, at: { word: "hicieron", offset: 0.15 }, scale: 0.6 },
    ],
    overlays: [
      {
        kind: "dataBox",
        text: "64 MIN",
        x: 580,
        y: 1110,
        at: { word: "64", offset: -0.4 },
        until: { word: "cómo", offset: -0.3 },
        count: { to: 64, until: { word: "minutos", edge: "end" } },
      },
    ],
    highlight: ["64", "hicieron"],
    headline: { text: "¿CÓMO LO *HICIERON*?", at: { word: "cómo" } },
  },
];
