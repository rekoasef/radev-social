// Catalog of the `studio` looks (docs/DESIGN-SYSTEM.md §10). Kept apart from their components so
// the schemas (tokens, carousel) and the AI guide can use it without pulling React in.

export const LOOK_IDS = [
  "editorial",
  "bloques",
  "atmosfera",
  "plano",
  "terminal",
  "recorte",
  "suizo",
  "revista",
  "neon",
  "monocromo",
  "bauhaus",
  "recibo",
  "chat",
  "documento",
  "gradiente",
  "brutalista",
] as const;

export type LookId = (typeof LOOK_IDS)[number];

export function isLookId(value: string): value is LookId {
  return (LOOK_IDS as readonly string[]).includes(value);
}

export const LOOK_NAMES: Record<LookId, string> = {
  editorial: "Editorial",
  bloques: "Bloques",
  atmosfera: "Atmósfera",
  plano: "Plano técnico",
  terminal: "Terminal",
  recorte: "Recorte",
  suizo: "Suizo",
  revista: "Revista",
  neon: "Neón",
  monocromo: "Monocromo",
  bauhaus: "Bauhaus",
  recibo: "Recibo",
  chat: "Chat",
  documento: "Documento",
  gradiente: "Gradiente",
  brutalista: "Brutalista",
};

/** What each look is good for: the AI reads it to choose (and the panel shows it). */
export const LOOK_GUIDE: Record<LookId, string> = {
  editorial:
    "Revista moderna: papel y tinta, tipografía enorme, listas con líneas finas. Para reflexiones, opiniones y temas serios.",
  bloques:
    "Pop: colores a pantalla completa, mayúsculas gigantes, stickers. Para hooks fuertes, advertencias y errores comunes.",
  atmosfera:
    "Cinematográfico: luces difusas y vidrio sobre oscuro. Para temas aspiracionales, visión, lanzamientos y tecnología.",
  plano:
    "Plano de ingeniería: grilla, cotas, tablas. Para procesos, arquitecturas, checklists y cómo funciona algo.",
  terminal:
    "Editor de código y consola. Para temas técnicos, de desarrollo, seguridad, IA y herramientas.",
  recorte:
    "Collage de papel, cinta y resaltador. Para historias, detrás de escena, casos y temas humanos o cercanos.",
  suizo:
    "Estilo suizo: grilla estricta, números de sección enormes, barras gruesas. Para guías ordenadas, listas y explicaciones paso a paso.",
  revista:
    "Revista clásica: títulos serif con itálicas, filetes dobles, aire de nota de tapa. Para ensayos, tendencias y opiniones con peso.",
  neon: "Neón nocturno: trazos que brillan sobre negro, grilla retro. Para novedades, trucos, curiosidades y temas llamativos.",
  monocromo:
    "Minimalismo extremo: una idea por slide, tipografía gigante, casi nada más. Para frases fuertes, verdades incómodas y mitos.",
  bauhaus:
    "Formas geométricas (círculos, semicírculos, triángulos) y color plano. Para conceptos, marcos mentales y comparaciones.",
  recibo:
    "Ticket de compra con renglones punteados y totales. Para costos, precios, presupuestos y lo que realmente se paga.",
  chat: "Conversación de mensajería con burbujas. Para atención al cliente, WhatsApp, preguntas frecuentes y diálogos con clientes.",
  documento:
    "Documento de trabajo con casillas, notas y comentarios al margen. Para planes, procesos internos, organización y productividad.",
  gradiente:
    "Claro y amable: degradados suaves y formas redondeadas. Para temas positivos, beneficios, primeros pasos y educación.",
  brutalista:
    "Brutalista: bordes gruesos, sombras duras, cajas crudas. Para opiniones filosas, rants, errores y comparaciones sin filtro.",
};
