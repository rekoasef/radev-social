// Lo que el operador puede cambiar de una escena en su escritorio (narración, pie, imagen), con los
// mismos controles que pasa la oficina de Guion. Sin I/O: guardar es de packages/db.
import type { ImageCandidate } from "./images";
import { dropSceneNameCards } from "./name-cards";
import { checkScript, type Script, scriptSchema } from "./script";
import { narrationWords, normWord } from "./text";

export type SceneEdit = {
  /** Número de escena (1 = la primera). */
  scene: number;
  narration?: string;
  /** Vacío: sacar el pie. */
  caption?: string;
  image?: string;
};

export type SceneEditResult = { ok: true; script: Script } | { ok: false; errors: string[] };

/** "scenes.3.graphics.0.at › …" → "Escena 4: …". */
export function operatorError(error: string): string {
  const match = error.match(/^scenes(?:\.(\d+))?[^›]*›\s*(.*)$/);
  if (!match) return error.replace(/^[^›]*›\s*/, "");
  const [, index, message] = match;
  return index === undefined ? (message ?? error) : `Escena ${Number(index) + 1}: ${message}`;
}

/**
 * Aplica el cambio y lo acepta solo si no suma errores que el guion no tuviera. No modifica el
 * guion que recibe.
 */
export function editScene(
  script: Script,
  edit: SceneEdit,
  candidates: ImageCandidate[],
  dossierText: string,
): SceneEditResult {
  const next = structuredClone(script);
  const scene = next.scenes[edit.scene - 1];
  if (!scene) return { ok: false, errors: ["Esa escena no existe."] };

  if (edit.narration !== undefined) {
    scene.narration = edit.narration.replace(/\s+/g, " ").trim();
    // Las palabras resaltadas que ya no se dicen dejan de resaltarse.
    const words = narrationWords(scene.narration);
    const kept = scene.highlight?.filter((h) => words.includes(normWord(h)));
    if (kept?.length) scene.highlight = kept;
    else delete scene.highlight;
  }
  if (edit.caption !== undefined) {
    const caption = edit.caption.trim();
    if (caption) scene.caption = caption;
    else delete scene.caption;
  }
  if (edit.image !== undefined && edit.image !== scene.image) {
    scene.image = edit.image;
    // Otra imagen: el encuadre anterior no sirve. Un acercamiento suave al centro.
    scene.from = { cx: 0.5, cy: 0.5, vw: 1 };
    scene.to = { cx: 0.5, cy: 0.45, vw: 0.6 };
    // What the AI declared was about the other image.
    delete scene.exact;
  }

  const shape = scriptSchema.safeParse(next);
  if (!shape.success) {
    const errors = shape.error.issues.map((i) =>
      operatorError(`${i.path.join(".")} › ${i.message}`),
    );
    return { ok: false, errors };
  }
  const before = new Set(checkScript(script, candidates, dossierText));
  const errors = checkScript(next, candidates, dossierText).filter((e) => !before.has(e));
  if (errors.length) return { ok: false, errors: errors.map(operatorError) };
  // After the checks: losing a card must not make the change fail.
  if (edit.image !== undefined) {
    next.scenes[edit.scene - 1] = dropSceneNameCards(scene, candidates).scene;
  }
  return { ok: true, script: next };
}

/**
 * El nombre del archivo de Commons a partir de lo que pegue el operador: la dirección de su página,
 * `File:…`, `Archivo:…` o el nombre con extensión. Null si no parece un archivo de Commons.
 */
export function commonsTitle(input: string): string | null {
  let text = input.trim();
  if (/^https?:\/\//i.test(text)) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (!/(^|\.)(wikimedia|wikipedia)\.org$/i.test(url.hostname)) return null;
    const path = url.pathname + url.hash;
    const found = path.match(/(?:File|Archivo|Fichier|Datei):([^/?#]+)/i)?.[1];
    if (!found) return null;
    try {
      text = decodeURIComponent(found);
    } catch {
      return null;
    }
  }
  text = text
    .replace(/^(File|Archivo|Fichier|Datei):/i, "")
    .replace(/_/g, " ")
    .trim();
  return /^[^[\]{}|#<>]{1,230}\.(jpe?g|png|webp|tiff?)$/i.test(text) ? text : null;
}
