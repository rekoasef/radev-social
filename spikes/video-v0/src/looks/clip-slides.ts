import type { Slide } from "@radev/slides";

// V0-5: una slide por escena del guion de V0-3 (texts/scenes-es.json), para verlas con la voz.
// Las cifras salen del guion de prueba; en V1 vienen de los datos (regla 9).
export const clipSlides: Slide[] = [
  {
    type: "cover",
    kicker: "Diciembre de 1978",
    title: "Seis hombres y *6 millones* de dólares",
    subtitle: "El robo del depósito de Lufthansa en el aeropuerto JFK",
  },
  {
    type: "bigNumber",
    value: "64 min",
    label: "es lo que *tardaron* en llevárselo",
    source: "Robo de Lufthansa, JFK, 1978",
  },
  {
    type: "steps",
    title: "Tenían *tres* ventajas",
    steps: [
      { title: "El plano", text: "Sabían dónde estaba cada cosa en el depósito de Lufthansa." },
      { title: "La hora", text: "Conocían el momento exacto del cambio de guardia." },
      { title: "Las cámaras", text: "Nadie las revisó esa noche." },
    ],
  },
  {
    type: "bigNumber",
    kicker: "Hoy, en una tienda online",
    value: "23 %",
    label: "de las ventas se pierden por *un error simple*",
    context: "Una página de pago que tarda más de 3 segundos en cargar.",
    source: "Dato del guion de prueba",
  },
  {
    type: "statement",
    composition: "drawing",
    icon: "calendar-clock",
    title: "Revisalo *antes del viernes 15*",
    body: "Si tu negocio vende por internet, medí cuánto tarda tu página de pago.",
  },
  {
    type: "cta",
    title: "¿Cuánto tarda *la tuya*?",
    subtitle: "Contanos en los comentarios y te decimos cómo bajarlo.",
    button: "Escribinos",
    icon: "message-circle",
  },
];
