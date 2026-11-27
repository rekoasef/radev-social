// Controls of the forms of telling a story (ADR 0030). The messages go back to the AI, so each one
// says what is wrong and where.
import { FORM_BEATS, FORM_LABELS, type VideoBeat, type VideoForm } from "@radev/core";

export type FormedScript = {
  form?: VideoForm;
  scenes: { beat?: VideoBeat; graphics: { kind: string }[] }[];
};

export type FormRequest = {
  /** The form the operator chose (or the one of the script being rewritten). */
  fixed?: VideoForm | null;
  /** The forms of the latest videos: not to be repeated. */
  avoid?: readonly VideoForm[];
};

/** Which form the script has to use; empty when it is fine. */
function checkChoice(form: VideoForm | undefined, request: FormRequest): string[] {
  const label = (f: VideoForm) => `«${f}» (${FORM_LABELS[f]})`;
  if (!form) return ["form › falta la forma de contar del video"];
  if (request.fixed) {
    return form === request.fixed
      ? []
      : [`form › la forma tiene que ser ${label(request.fixed)}, no ${label(form)}`];
  }
  if (request.avoid?.includes(form)) {
    return [
      `form › ${label(form)} ya se usó en los últimos videos: elegí otra que no sea ${request.avoid.map(label).join(" ni ")}`,
    ];
  }
  return [];
}

/**
 * Whether the script follows its form. `request` is given only by the Script office: with it the
 * choice of form is checked, and so are the rules about graphics that a later correction may break
 * on purpose (the fact check takes out misleading name cards).
 */
export function checkForm(g: FormedScript, request?: FormRequest): string[] {
  const errors = request ? checkChoice(g.form, request) : [];
  const form = g.form;
  if (!form) return errors;

  const total = g.scenes.length;
  const beats = g.scenes.map((s) => s.beat);
  const allowed: readonly VideoBeat[] = FORM_BEATS[form];
  // The operator's opinion fits any form, and does not count in its proportions (ADR 0031).
  const bad = beats.flatMap((b, i) => (b === "aporte" || (b && allowed.includes(b)) ? [] : [i]));
  const told = beats.filter((b) => b !== "aporte").length;
  for (const i of bad) {
    errors.push(
      `scenes.${i}.beat › en «${form}» el papel tiene que ser uno de: ${allowed.join(", ")}`,
    );
  }
  if (bad.length) return errors; // the rules below read the roles
  if (beats[0] !== "gancho") errors.push("scenes.0.beat › la primera escena es el «gancho»");
  if (beats[total - 1] !== "cierre") {
    errors.push(`scenes.${total - 1}.beat › la última escena es el «cierre»`);
  }

  const at = (beat: VideoBeat) => beats.flatMap((b, i) => (b === beat ? [i] : []));
  const atLeast = (beat: VideoBeat, min: number) => {
    const n = at(beat).length;
    if (n < min) errors.push(`scenes › «${form}» pide al menos ${min} escenas «${beat}»; hay ${n}`);
  };

  if (form === "cronologia") {
    atLeast("hecho", Math.ceil(told * 0.6));
  }

  if (form === "misterio") {
    if (g.scenes[0]?.graphics.some((x) => x.kind === "fecha")) {
      errors.push(
        "scenes.0.graphics › en «misterio» la escena 1 es el enigma: sin cartel de fecha ni lugar",
      );
    }
    const reveal = at("revelacion")[0];
    if (reveal === undefined) {
      errors.push("scenes › «misterio» necesita una escena «revelacion» en el último tercio");
    } else {
      const opinions = at("aporte").filter((i) => i < reveal).length;
      if ((reveal - opinions + 1) / told <= 0.6) {
        errors.push(
          `scenes.${reveal}.beat › la primera «revelacion» va en el último tercio (de la escena ${Math.floor(told * 0.6) + opinions + 1} en adelante), no en la ${reveal + 1}`,
        );
      }
      const clues = at("pista").filter((i) => i < reveal).length;
      if (clues < 3) {
        errors.push(`scenes › antes de la revelación van al menos 3 escenas «pista»; hay ${clues}`);
      }
    }
  }

  if (form === "contraste") {
    atLeast("ladoA", 3);
    atLeast("ladoB", 3);
    const sides = beats.filter((b) => b === "ladoA" || b === "ladoB");
    const changes = sides.filter((b, i) => i > 0 && b !== sides[i - 1]).length;
    if (changes < 2) {
      errors.push(
        `scenes › los lados A y B tienen que alternarse: al menos 2 cambios de lado, hay ${changes}`,
      );
    }
    const lastSide = Math.max(...at("ladoA"), ...at("ladoB"), -1);
    if (!at("veredicto").some((i) => i > lastSide)) {
      errors.push("scenes › después del último lado va un «veredicto», con su matiz");
    }
  }

  if (form === "despues") {
    const facts = at("hecho");
    const after = at("despues");
    if (facts.length > 4) {
      errors.push(
        `scenes › el hecho se resuelve en 4 escenas «hecho» como mucho; hay ${facts.length}`,
      );
    }
    const first = after[0];
    if (first !== undefined && facts.some((i) => i > first)) {
      errors.push("scenes › todas las escenas «hecho» van antes de la primera «despues»");
    }
    atLeast("despues", Math.ceil(told * 0.6));
    if (request) {
      const cards = after.filter((i) => g.scenes[i]?.graphics.some((x) => x.kind === "nombre"));
      if (cards.length < 2) {
        errors.push(
          `scenes › cada bloque de «qué fue de…» se presenta con un cartel «nombre»: poné al menos 2 en escenas «despues»; hay ${cards.length}`,
        );
      }
    }
  }
  return errors;
}
