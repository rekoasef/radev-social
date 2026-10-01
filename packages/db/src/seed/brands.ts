import { type AssetRole, type BrandDocumentKind, WEEKDAYS, type Weekday } from "@radev/core";
import type { NewBrand, NewContentPillar } from "../schema";

/**
 * Initial brands. Values come from docs/DESIGN-SYSTEM.md §7 (RAdev, preset "bold") and
 * §8 (Lumus, preset "soft"). After seeding, the database is the source of truth.
 */
export const seedBrands: NewBrand[] = [
  {
    slug: "radev",
    name: "RAdev",
    codePrefix: "RA",
    stylePreset: "bold",
    website: "radev.tech",
    timezone: "America/Argentina/Buenos_Aires",
    postsPerDayTarget: 1,
    themeTokens: {
      colors: {
        bg: "#0B0B0B",
        surface: "#121212",
        accent: "#FF7A00",
        text: "#FFFFFF",
        muted: "#A1A1AA",
        line: "#27272A",
      },
      glow: { intensity: 0.35 },
      fonts: {
        display: { family: "Inter Tight", weight: 900 },
        body: { family: "Inter", weight: 300 },
        label: { family: "Inter", weight: 500 },
      },
      radius: { card: 16, callout: 20 },
      header: { left: "PROCESOS DE HOY", right: "RESULTADOS DE MAÑANA" },
      footer: { tagline: ["AUTOMATIZACIÓN", "IDEAS EN RESULTADOS"] },
      wordmark: { strong: "RA", light: "dev", dot: true },
      logoAsset: null,
    },
  },
  {
    slug: "lumus",
    name: "Lumus",
    codePrefix: "LU",
    stylePreset: "soft",
    timezone: "America/Argentina/Buenos_Aires",
    postsPerDayTarget: 1,
    // Personal money in Argentina: its content may show the dollar (phase 3, T11).
    dataSources: ["bluelytics"],
    themeTokens: {
      colors: {
        bg: "#0B0B12",
        surface: "#171620",
        elevated: "#1D1B28",
        line: "#2E2B3D",
        text: "#F0EDF7",
        secondary: "#C8C4D7",
        muted: "#8F8B9E",
        accent: "#BDB4FF",
        wordmark: "#E4DFFF",
        accent2: "#FFB86E",
        positive: "#22C55E",
        negative: "#EF4444",
      },
      glass: {
        background: "rgba(24,23,34,0.68)",
        border: "rgba(255,255,255,0.08)",
        borderTop: "rgba(255,255,255,0.14)",
      },
      glows: [
        { position: "top-left", color: "rgba(189,180,255,0.08)" },
        { position: "top-right", color: "rgba(255,184,110,0.045)" },
      ],
      fonts: {
        display: { family: "Hanken Grotesk", weight: 600 },
        body: { family: "Geist Sans", weight: 400 },
        numeric: { family: "Geist Mono", weight: 500 },
      },
      radius: { card: 12, panel: 16 },
      wordmark: { text: "LUMUS", tracking: 0.18 },
      footer: { url: "gestorlumus.site" },
      // Ids in brand_assets: the seed links them (seedBrandAssets).
      heroAsset: null,
      logoAsset: null,
    },
  },
];

export type SeedAsset = {
  /** File in seeds/brands/<slug>/assets/. */
  file: string;
  role: AssetRole;
  /** Top-level theme token that points to it. */
  token: string;
};

/** Files the seed uploads for each brand and links in its tokens. */
export const seedBrandAssets: Record<string, SeedAsset[]> = {
  lumus: [
    { file: "lumus-orb.png", role: "hero", token: "heroAsset" },
    { file: "logoLumus.png", role: "logo", token: "logoAsset" },
  ],
};

/**
 * Seed assets still to link. Never touches what the operator set up: a token that already
 * points somewhere, or a role the brand already has a file for, is left alone. Running the
 * seed again adds nothing.
 */
export function pendingSeedAssets(
  planned: readonly SeedAsset[],
  tokens: Record<string, unknown>,
  existingRoles: readonly AssetRole[],
): SeedAsset[] {
  return planned.filter(
    (asset) => tokens[asset.token] == null && !existingRoles.includes(asset.role),
  );
}

/**
 * Brand documents to load from seeds/brands/<slug>/<kind>.md: the kinds with a file on disk
 * that the brand doesn't have yet. Once a kind exists it belongs to the panel; the seed never
 * adds versions on top of it.
 */
export function pendingSeedDocuments(
  onDisk: readonly BrandDocumentKind[],
  existing: readonly BrandDocumentKind[],
): BrandDocumentKind[] {
  return onDisk.filter((kind) => !existing.includes(kind));
}

export type SeedPillar = Pick<
  NewContentPillar,
  | "key"
  | "name"
  | "description"
  | "targetShare"
  | "goal"
  | "hookTypes"
  | "guide"
  | "closing"
  | "avoid"
>;

/**
 * Content pillars from each brand's voice document (seeds/brands/<slug>/voice.md, "Pilares y
 * mezcla"). Proposed mix, to validate; edited from the panel in phase 3.
 */
export const seedPillars: Record<string, SeedPillar[]> = {
  radev: [
    {
      key: "business-problems",
      name: "Problemas de negocio",
      description: "Dolores típicos de negocios y cómo se resuelven con procesos y software",
      targetShare: 0.4,
      goal: "reach",
      hookTypes: ["warning", "question", "myth", "cost"],
      guide:
        "Un dolor concreto de un tipo de negocio (turnos por WhatsApp, planillas que nadie entiende, stock a ojo), lo que cuesta no resolverlo y cómo se resuelve con un proceso o un software. Sin tecnicismos: se habla del negocio, no de la tecnología.",
      closing: 'Una pregunta para que comenten si les pasa ("¿te pasa?").',
      avoid: "Nombrar tecnologías, prometer resultados y mostrar precios.",
    },
    {
      key: "built-by-radev",
      name: "Hecho por RAdev",
      description: "Casos reales, antes y después, proyectos terminados (solo de la sección Casos)",
      targetShare: 0.2,
      goal: "trust",
      hookTypes: ["story", "howto"],
      guide:
        "Un caso de la sección Casos por post: problema, solución y resultado, como un antes y después. Al cliente se lo nombra solo si Casos lo permite.",
      closing: '"¿Querés algo así para tu negocio? Entrá a radev.tech."',
      avoid: "Casos o resultados que no estén en Casos.",
    },
    {
      key: "build-in-public",
      name: "Construcción en público",
      description: "Detrás de escena de construir Lumus y otros proyectos, con la parte técnica",
      targetShare: 0.15,
      goal: "trust",
      hookTypes: ["story", "howto", "comparison"],
      guide:
        "Una decisión o un error real construyendo Lumus, Nexora u otro proyecto propio, con la parte técnica explicada en simple: qué pasó, qué se decidió y qué se aprendió.",
      closing: "Invitar a seguir la cuenta para ver cómo sigue.",
      avoid: "Métricas o números de Lumus que no estén en los datos.",
    },
    {
      key: "programming-explained",
      name: "Programación explicada",
      description: "Conceptos técnicos contados en simple, siempre ligados a un problema real",
      targetShare: 0.15,
      goal: "reach",
      hookTypes: ["myth", "comparison", "question"],
      guide:
        "Un concepto (API, base de datos, hosting, dominio, automatización) contado en simple y atado a un problema de negocio. Las comparaciones van con un criterio concreto para elegir.",
      closing: "Invitar a guardar el post o a comentar una duda.",
      avoid: 'Jerga sin explicar y "ganadores absolutos".',
    },
    {
      key: "call-to-action",
      name: "Llamado a la acción",
      description: "Servicios, contacto, y promoción de Lumus",
      targetShare: 0.1,
      goal: "sales",
      hookTypes: ["question", "story"],
      guide:
        "Un servicio concreto (web, sistema a medida, automatización, bot de WhatsApp) presentado desde el problema que resuelve, con un caso de Casos como prueba.",
      closing: "Entrar a radev.tech.",
      avoid: "Listas genéricas de servicios y precios.",
    },
  ],
  lumus: [
    {
      key: "peso-vs-dollar",
      name: "Peso vs. dólar",
      description: 'Datos reales de devaluación y poder de compra ("tus 100 mil de 2020, hoy")',
      targetShare: 0.35,
      goal: "reach",
      hookTypes: ["data", "comparison"],
      guide:
        "Un dato real de los datos de la marca (dólar, poder de compra) contado como lo que le pasa a la plata de todos los días.",
      closing: '"Lumus te lo muestra con tus números."',
      avoid:
        "Política o culpables, decir que conviene comprar dólares y números que no estén en los datos.",
    },
    {
      key: "money-habits",
      name: "Hábitos con la plata",
      description: "Ordenar gastos, presupuestos, cuotas, gastos hormiga, vencimientos",
      targetShare: 0.3,
      goal: "reach",
      hookTypes: ["howto", "warning", "question"],
      guide:
        "Un hábito concreto (gastos hormiga, cuotas, vencimientos, presupuesto mensual) con pasos para aplicar hoy. Lumus aparece al final como la herramienta que lo hace fácil, sin forzarlo.",
      closing: "Invitar a guardar el post.",
      avoid: "Recomendar inversiones y prometer ahorro.",
    },
    {
      key: "money-myths",
      name: "Mitos de la plata",
      description: "Creencias comunes sobre la plata diaria, desmentidas con claridad",
      targetShare: 0.15,
      goal: "reach",
      hookTypes: ["myth", "question"],
      guide:
        'Una creencia común sobre la plata diaria ("las cuotas sin interés son gratis") desmentida con claridad.',
      closing: "Una pregunta para que comenten.",
      avoid: "Asesoramiento financiero y tono de sermón.",
    },
    {
      key: "inside-lumus",
      name: "Lumus por dentro",
      description: "Qué hace Lumus y cómo, mostrando funciones concretas",
      targetShare: 0.1,
      goal: "trust",
      hookTypes: ["howto", "story"],
      guide:
        "Una función real de Lumus en uso (informe mensual con IA, pesos y dólares, metas, vencimientos) y por qué está hecha así: las cuentas las hace el sistema y la IA solo las explica.",
      closing: '"Probalo 30 días gratis."',
      avoid: "Funciones que Lumus no tiene, como la conexión con bancos.",
    },
    {
      key: "try-lumus",
      name: "Probá Lumus",
      description: "Invitación a la prueba gratis",
      targetShare: 0.1,
      goal: "sales",
      hookTypes: ["question", "story"],
      guide: "Un solo problema que Lumus resuelve y la prueba gratis de 30 días sin tarjeta.",
      closing: "Empezar la prueba gratis.",
      avoid: "Prometer resultados y criticar otras apps.",
    },
  ],
};

/**
 * Publishing slots of a brand the seed creates (docs/ROADMAP.md, phase 4: start with 1 post a day
 * between 14 and 21 h). Only for brands created in that same run: a brand that already exists keeps
 * the slots edited from the panel, even none.
 */
export const seedSlots: Record<string, { weekdays: Weekday[]; localTime: string }[]> = {
  radev: [{ weekdays: [...WEEKDAYS], localTime: "19:00" }],
  lumus: [{ weekdays: [...WEEKDAYS], localTime: "19:00" }],
};
