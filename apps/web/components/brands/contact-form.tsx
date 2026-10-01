"use client";

import {
  normalizeWebsite,
  normalizeWhatsappMessage,
  normalizeWhatsappNumber,
  WHATSAPP_MESSAGE_MAX,
  whatsappLink,
  whatsappMessage,
} from "@radev/core";
import { useActionState, useId, useState } from "react";
import { type ContactFormState, saveContactAction } from "@/app/(panel)/brands/actions";

const idle: ContactFormState = { status: "idle" };

/**
 * Where the posts' closing slide sends people: the brand's website or, without one, its WhatsApp
 * (ADR 0023). The WhatsApp message a lead finds already written carries the post's code in
 * `{code}`; the preview uses a sample code of the brand.
 */
export function ContactForm({
  id,
  codePrefix,
  website,
  number,
  message,
  readOnly,
}: {
  id: string;
  codePrefix: string;
  website: string | null;
  number: string | null;
  message: string | null;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(saveContactAction, idle);
  const [typedWebsite, setTypedWebsite] = useState(website ?? "");
  const [typedNumber, setTypedNumber] = useState(number ? `+${number}` : "");
  const [typedMessage, setTypedMessage] = useState(message ?? "");
  const ids = { website: useId(), number: useId(), message: useId() };

  const sampleCode = `${codePrefix}-0142`;
  const parsedWebsite = normalizeWebsite(typedWebsite);
  const site = parsedWebsite.ok ? parsedWebsite.value : null;
  const parsedNumber = normalizeWhatsappNumber(typedNumber);
  const parsedMessage = normalizeWhatsappMessage(typedMessage);
  const preview =
    parsedMessage.ok && parsedMessage.value
      ? whatsappMessage(parsedMessage.value, sampleCode)
      : null;
  const link =
    parsedNumber.ok && parsedNumber.value ? whatsappLink(parsedNumber.value, preview) : null;
  const error = (field: "website" | "number" | "message") =>
    state.status === "error" && state.field === field ? state.message : undefined;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-6">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-2">
        <label htmlFor={ids.website} className="plate-text text-ink-faint">
          Sitio web
        </label>
        <input
          id={ids.website}
          name="website"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={typedWebsite}
          onChange={(event) => setTypedWebsite(event.target.value)}
          placeholder="radev.tech"
          readOnly={readOnly}
          aria-invalid={error("website") ? true : undefined}
          className="console-field timecode"
        />
        <p className={`text-sm ${error("website") ? "text-tally-red" : "text-ink-faint"}`}>
          {error("website") ??
            (site
              ? `Los posts cierran mandando a ${site} (por ejemplo "Entrá a ${site}").`
              : "Vacío: los posts cierran invitando a escribir por WhatsApp.")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={ids.number} className="plate-text text-ink-faint">
          WhatsApp
        </label>
        <input
          id={ids.number}
          name="number"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={typedNumber}
          onChange={(event) => setTypedNumber(event.target.value)}
          placeholder="+54 9 351 555 1234"
          readOnly={readOnly}
          aria-invalid={error("number") ? true : undefined}
          className="console-field timecode"
        />
        <p className={`text-sm ${error("number") ? "text-tally-red" : "text-ink-faint"}`}>
          {error("number") ??
            (site
              ? "Con el código de país. Con sitio web, el cierre de los posts no lo usa."
              : "Con el código de país. Vacío: los posts cierran sin invitar a escribir.")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={ids.message} className="flex items-baseline justify-between gap-3 text-sm">
          <span className="plate-text text-ink-faint">Mensaje precargado</span>
          <span className="timecode text-xs text-ink-faint">
            {typedMessage.trim().length}/{WHATSAPP_MESSAGE_MAX}
          </span>
        </label>
        <textarea
          id={ids.message}
          name="message"
          rows={2}
          lang="es"
          value={typedMessage}
          onChange={(event) => setTypedMessage(event.target.value)}
          placeholder="¡Hola! Vi tu post {code} y quiero consultar."
          readOnly={readOnly}
          aria-invalid={error("message") ? true : undefined}
          className="console-field w-full text-sm leading-relaxed"
        />
        <p className={`text-sm ${error("message") ? "text-tally-red" : "text-ink-faint"}`}>
          {error("message") ??
            "{code} se reemplaza por el código del post (ej. RA-0142): así sabés de qué post vino cada consulta."}
        </p>
        {preview && (
          <p className="border-l border-bezel pl-3 text-sm text-ink-dim">
            <span className="plate-text mr-2 text-ink-faint">Así llega</span>
            {preview}
          </p>
        )}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            className="console-button console-button-primary"
            disabled={pending}
          >
            {pending ? "Guardando…" : "Guardar contacto"}
          </button>
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="console-button">
              Probar enlace
            </a>
          )}
          {state.status === "ok" && (
            <p role="status" className="text-sm text-ink-dim">
              {state.message}
            </p>
          )}
          {state.status === "error" && !state.field && (
            <p role="alert" className="text-sm text-tally-red">
              {state.message}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
