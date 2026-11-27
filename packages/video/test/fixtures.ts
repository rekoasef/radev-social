import { readFileSync } from "node:fs";
import type { Dossier, ImageCandidate, Publication, Script } from "../src";

const load = <T>(name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as T;

/**
 * El video de la Mona Lisa (2026-11-25): guion ya verificado, imágenes, dossier y voz reales. En el
 * guion, las escenas 7, 8 y 14 cambiaron de imagen (2026-11-27): repetían con candidatas sin usar.
 */
export const monaScript = () => load<Script>("mona-script.json");
export const monaCandidates = () => load<ImageCandidate[]>("mona-candidates.json");
export const monaDossier = () => load<Dossier>("mona-dossier.json");
export const monaPublication = () => load<Publication>("mona-publication.json");
export const monaManifest = () =>
  load<{ scenes: { frames: number }[] }>("mona-voice-manifest.json");
