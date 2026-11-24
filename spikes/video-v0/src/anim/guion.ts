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

export type Outfit = "ladron" | "guardia" | "civil" | "dueno";

export type Action =
  | { do: "walk"; at: Cue; toX: number; speed?: number }
  | { do: "lookWatch"; at: Cue; until?: Cue }
  | { do: "scratchHead"; at: Cue; until?: Cue }
  | { do: "panic"; at: Cue; until?: Cue }
  | { do: "point"; at: Cue; until?: Cue }
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
  | { kind: "question"; x: number; y: number; at: Cue; scale?: number }
  /** Ruta punteada que se dibuja sola sobre el plano (de la entrada a la bóveda). */
  | { kind: "route"; at: Cue; until: Cue }
  /** Punto con nombre sobre el plano; con `moveTo` se va a otro lugar. */
  | {
      kind: "marker";
      label: string;
      x: number;
      y: number;
      at: Cue;
      moveTo?: { x: number; y: number; at: Cue };
    }
  /** Cámara de seguridad que gira; en `off` se tacha. */
  | { kind: "securityCam"; x: number; y: number; at: Cue; off: Cue; scale?: number }
  /** Celular con una tienda; desde `loadingAt`, la página de pago cargando. */
  | { kind: "phone"; x: number; y: number; at: Cue; loadingAt?: Cue; scale?: number };

export type Overlay =
  /** Lista que se completa ítem por ítem (✓ o ✗). */
  | {
      kind: "checklist";
      x: number;
      y: number;
      items: { text: string; mark: "ok" | "no"; at: Cue }[];
    }
  /** Etiqueta chica en mayúsculas ("CAMBIO DE GUARDIA"). */
  | {
      kind: "tag";
      text: string;
      x: number;
      y: number;
      at: Cue;
      until?: Cue;
      color?: "rojo" | "azul";
    }
  /** Caja de dato con rebote. `count` cuenta desde 0 hasta el número entre `at` y `count.until`. */
  | {
      kind: "dataBox";
      text: string;
      sub?: string;
      x: number;
      y: number;
      at: Cue;
      until?: Cue;
      count?: { to: number; until: Cue };
    };

export type Setting = "aeropuerto-noche" | "reloj-alarma" | "plano" | "tienda";

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
  /** Segundos de imagen después de la voz (el cierre, para leer el pedido de comentarios). */
  tail?: number;
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
  {
    voice: 2,
    narration:
      "Tenían un plano del depósito de Lufthansa, sabían a qué hora cambiaba la guardia y nadie revisó las cámaras.",
    setting: "plano",
    camera: [
      { at: 0, zoom: 1, x: 540, y: 960 },
      { at: { word: "cámaras", edge: "end" }, zoom: 1.1, x: 560, y: 900 },
    ],
    actors: [],
    props: [
      {
        kind: "route",
        at: { word: "plano", offset: 0.1 },
        until: { word: "lufthansa", edge: "end" },
      },
      {
        kind: "marker",
        label: "GUARDIA",
        x: 230,
        y: 1010,
        at: 0,
        moveTo: { x: 40, y: 1180, at: { word: "cambiaba" } },
      },
      { kind: "securityCam", x: 470, y: 600, at: 0.2, off: { word: "nadie" }, scale: 0.8 },
      { kind: "securityCam", x: 900, y: 1040, at: 0.35, off: { word: "revisó" }, scale: 0.8 },
    ],
    overlays: [
      {
        kind: "checklist",
        x: 110,
        y: 1300,
        items: [
          { text: "EL PLANO", mark: "ok", at: { word: "plano" } },
          { text: "LA HORA DEL CAMBIO", mark: "ok", at: { word: "guardia" } },
          { text: "CÁMARAS SIN MIRAR", mark: "ok", at: { word: "cámaras" } },
        ],
      },
      {
        kind: "tag",
        text: "CAMBIO DE GUARDIA",
        x: 300,
        y: 960,
        at: { word: "cambiaba" },
        until: { word: "nadie", offset: -0.1 },
        color: "azul",
      },
    ],
    highlight: ["plano", "guardia", "cámaras"],
  },
  {
    voice: 3,
    narration:
      "Hoy, una tienda online pierde el 23 % de sus ventas por un error igual de simple: una página de pago que tarda más de 3 segundos en cargar.",
    setting: "tienda",
    camera: [
      { at: 0, zoom: 1.04, x: 540, y: 960 },
      { at: { word: "página" }, zoom: 1.04, x: 560, y: 960 },
      { at: { word: "cargar", edge: "end" }, zoom: 1.14, x: 620, y: 940 },
    ],
    actors: [
      {
        id: "cliente",
        outfit: "civil",
        x: -200,
        y: 1330,
        scale: 1.45,
        facing: "right",
        enter: { word: "tienda" },
        actions: [
          { do: "walk", at: { word: "tienda" }, toX: 280, speed: 420 },
          { do: "lookWatch", at: { word: "tarda" }, until: { word: "segundos", edge: "end" } },
          { do: "walk", at: { word: "cargar" }, toX: -260, speed: 520 },
        ],
      },
    ],
    props: [
      {
        kind: "phone",
        x: 730,
        y: 820,
        at: { word: "tienda", offset: 0.15 },
        loadingAt: { word: "página" },
        scale: 0.9,
      },
    ],
    overlays: [
      { kind: "dataBox", text: "HOY", x: 540, y: 820, at: 0, until: { word: "una", offset: 0.1 } },
      {
        kind: "dataBox",
        text: "−23 %",
        sub: "DE LAS VENTAS",
        x: 540,
        y: 640,
        at: { word: "23", offset: -0.1 },
        until: { word: "una", nth: 2, offset: -0.2 },
        count: { to: 23, until: { word: "ventas", edge: "end" } },
      },
      {
        kind: "dataBox",
        text: "+3 SEG",
        sub: "CARGANDO EL PAGO",
        x: 730,
        y: 1250,
        at: { word: "más" },
        count: { to: 3, until: { word: "segundos", edge: "end" } },
      },
    ],
    highlight: ["23", "%", "pago", "3", "segundos"],
    headline: { text: "VENTAS *PERDIDAS*", at: { word: "pierde" } },
  },
  {
    voice: 4,
    narration: "Si tu negocio vende por internet, revisá esto antes del viernes 15.",
    setting: "tienda",
    camera: [
      { at: 0, zoom: 1.1, x: 480, y: 980 },
      { at: { word: "viernes" }, zoom: 1.02, x: 540, y: 960 },
    ],
    actors: [
      {
        id: "duenio",
        outfit: "dueno",
        x: 300,
        y: 1330,
        scale: 1.5,
        facing: "right",
        actions: [{ do: "point", at: { word: "revisá" } }],
      },
    ],
    props: [
      {
        kind: "calendar",
        month: "VIERNES",
        year: "15",
        x: 730,
        y: 980,
        at: { word: "viernes", offset: -0.15 },
      },
    ],
    overlays: [
      {
        kind: "tag",
        text: "REVISÁ TU PÁGINA DE PAGO",
        x: 700,
        y: 640,
        at: { word: "esto" },
        color: "rojo",
      },
    ],
    highlight: ["negocio", "viernes", "15"],
    headline: { text: "ANTES DEL *VIERNES*", at: { word: "antes" } },
  },
  {
    voice: 5,
    narration: "¿Vos sabés cuánto tarda la tuya?",
    setting: "tienda",
    camera: [
      { at: 0, zoom: 1, x: 540, y: 960 },
      { at: { word: "tuya", edge: "end" }, zoom: 1.12, x: 540, y: 900 },
    ],
    actors: [],
    props: [
      { kind: "phone", x: 540, y: 820, at: 0, loadingAt: 0, scale: 1 },
      { kind: "question", x: 200, y: 700, at: { word: "cuánto" }, scale: 0.7 },
      { kind: "question", x: 880, y: 640, at: { word: "tuya" }, scale: 0.9 },
    ],
    overlays: [
      {
        kind: "tag",
        text: "CONTANOS EN LOS COMENTARIOS",
        x: 540,
        y: 1260,
        at: { word: "tuya", edge: "end", offset: 0.2 },
        color: "azul",
      },
    ],
    highlight: ["cuánto", "tuya"],
    headline: { text: "¿CUÁNTO TARDA *LA TUYA*?", at: { word: "cuánto" } },
    tail: 1.6,
  },
];

export type SceneVoice = {
  audio: string;
  words: { word: string; start: number; end: number }[];
  frames: number;
};

/** Cuadros de una escena: los de su voz más la cola del guion (a 30 fps). */
export function sceneFrames(scene: GuionScene, voice: SceneVoice): number {
  return voice.frames + Math.round((scene.tail ?? 0) * 30);
}
