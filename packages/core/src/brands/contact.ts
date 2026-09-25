// A brand's WhatsApp for its calls to action (docs/PRD.md RF-07). The prefilled message carries
// the post's public code (`{code}`, e.g. RA-0142) so each lead can be traced to a post (RF-41).

/** International format without "+": country code, area code and number (wa.me takes it so). */
export const WHATSAPP_NUMBER_PATTERN = /^[1-9]\d{7,14}$/;
export const WHATSAPP_MESSAGE_MAX = 300;
export const POST_CODE_PLACEHOLDER = "{code}";

export type ContactCheck<T> = { ok: true; value: T } | { ok: false; reason: string };

/** "+54 9 351 555-1234" → "5493515551234". Empty means no WhatsApp. */
export function normalizeWhatsappNumber(input: string): ContactCheck<string | null> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) {
    return { ok: false, reason: "Solo números, con el código de país (ej. +54 9 351 555 1234)." };
  }
  const digits = trimmed.replace(/\D/g, "");
  return WHATSAPP_NUMBER_PATTERN.test(digits)
    ? { ok: true, value: digits }
    : {
        ok: false,
        reason: "Poné el número completo con el código de país (ej. +54 9 351 555 1234).",
      };
}

/** Empty means no prefilled message. Otherwise it has to carry the post's code. */
export function normalizeWhatsappMessage(input: string): ContactCheck<string | null> {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: true, value: null };
  if (trimmed.length > WHATSAPP_MESSAGE_MAX) {
    return { ok: false, reason: `Máximo ${WHATSAPP_MESSAGE_MAX} caracteres.` };
  }
  if (!trimmed.includes(POST_CODE_PLACEHOLDER)) {
    return {
      ok: false,
      reason: `Incluí ${POST_CODE_PLACEHOLDER}: ahí va el código del post, para saber de qué post vino el mensaje.`,
    };
  }
  const unknown = trimmed.match(/\{[^}]*\}/g)?.find((token) => token !== POST_CODE_PLACEHOLDER);
  if (unknown) return { ok: false, reason: `${unknown} no existe: la única variable es {code}.` };
  return { ok: true, value: trimmed };
}

/** The prefilled message for one post. */
export function whatsappMessage(template: string, postCode: string): string {
  return template.replaceAll(POST_CODE_PLACEHOLDER, postCode);
}

/** Link that opens a chat with the brand, with the message already written when there is one. */
export function whatsappLink(number: string, message?: string | null): string {
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
