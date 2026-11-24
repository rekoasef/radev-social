// V0-8: valida un guion con las dos capas (Zod + sentido). Sin argumentos, el guion escrito a mano
// de V0-6 (tiene que pasar). Uso:
//   pnpm --filter @radev/spike-video-v0 guion:check [out/v0-8/<archivo>.json]
import { readFileSync } from "node:fs";
import path from "node:path";
import { guion } from "../src/anim/guion";
import { normalizeGuion } from "../src/anim/quality";
import { checkGuion, guionLargoSchema } from "../src/anim/schema";

const file = process.argv[2];
const raw: unknown = file
  ? (JSON.parse(readFileSync(path.resolve(file), "utf8")) as { guion?: unknown }).guion
  : {
      title: "El robo del siglo",
      scenes: guion.map(({ voice: _, ...scene }) => scene),
      facts: [],
    };

const parsed = guionLargoSchema.safeParse(raw);
if (!parsed.success) {
  console.log("Zod: NO pasa");
  for (const issue of parsed.error.issues)
    console.log(`  ${issue.path.join(".")} › ${issue.message}`);
  process.exit(1);
}
// V0-10: primero lo que el código arregla solo.
const { guion: fixed, fixes } = normalizeGuion(parsed.data);
for (const f of fixes) console.log(`arreglado: ${f}`);
const errors = checkGuion(fixed);
console.log(`Zod: pasa · sentido: ${errors.length === 0 ? "pasa" : `${errors.length} errores`}`);
for (const e of errors) console.log(`  ${e}`);
process.exit(errors.length === 0 ? 0 : 1);
