// A name card says "this is X". It only stays if the image's own title or description names X:
// otherwise it can label the wrong person or turn any object into "the evidence" (first real video,
// docs/VIDEO-CALIDAD.md). A repair by code, not a check: it never costs the office another try.
import type { ImageCandidate } from "./images";
import type { Script, ScriptScene } from "./script";

const words = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** One letter changed, missing or extra: Commons writes "Perugia" for Peruggia. */
function nearlySame(a: string, b: string): boolean {
  if (a === b) return true;
  // Short words one letter apart are usually different names.
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  const skipA = a.length >= b.length ? 1 : 0;
  const skipB = b.length >= a.length ? 1 : 0;
  return a.slice(i + skipA) === b.slice(i + skipB);
}

/** Whether the image names it: by the last meaningful word (a surname, "Louvre", "Columbia"). */
export function imageNames(candidate: ImageCandidate, name: string): boolean {
  const key = words(name)
    .filter((w) => w.length >= 3)
    .at(-1);
  if (key === undefined) return false;
  return words(`${candidate.title} ${candidate.description}`).some((w) => nearlySame(w, key));
}

/** The scene without the name cards its image does not back, and the names removed. */
export function dropSceneNameCards(
  scene: ScriptScene,
  candidates: ImageCandidate[],
): { scene: ScriptScene; dropped: string[] } {
  const image = candidates.find((c) => c.id === scene.image);
  const dropped: string[] = [];
  const graphics = scene.graphics.filter((g) => {
    if (g.kind !== "nombre" || (image && imageNames(image, g.name))) return true;
    dropped.push(g.name);
    return false;
  });
  return { scene: dropped.length ? { ...scene, graphics } : scene, dropped };
}

export function dropNameCards(
  script: Script,
  candidates: ImageCandidate[],
): { script: Script; dropped: { scene: number; name: string }[] } {
  const dropped: { scene: number; name: string }[] = [];
  const scenes = script.scenes.map((s, i) => {
    const result = dropSceneNameCards(s, candidates);
    for (const name of result.dropped) dropped.push({ scene: i + 1, name });
    return result.scene;
  });
  return { script: dropped.length ? { ...script, scenes } : script, dropped };
}
