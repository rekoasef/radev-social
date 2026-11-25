// Chequeo sin IA de las correcciones por parches (src/anim/patch.ts), con guiones reales guardados:
// el parche se arma con las escenas que difieren entre un guion y su corrección, y al aplicarlo
// tiene que dar la corrección. Uso: pnpm patch:check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyPatch, patchSchema } from "../src/anim/patch";
import { type GuionDraft, guionLargoSchema } from "../src/anim/schema";

const load = (f: string) =>
  (
    JSON.parse(readFileSync(new URL(`../out/${f}`, import.meta.url), "utf8")) as {
      guion: GuionDraft;
    }
  ).guion;
const before = load("v0-13/guion-2-low-long-glow.json");
const after = load("v0-13/guion-2-low-long-glow-repair1.json");

const changedScenes = after.scenes
  .map((scene, i) => ({ n: i + 1, scene }))
  .filter(({ n, scene }) => JSON.stringify(scene) !== JSON.stringify(before.scenes[n - 1]));
const patch = patchSchema.parse({
  scenes: changedScenes,
  cast: after.cast,
  missingPlaces: after.missingPlaces,
  facts: after.facts,
  title: after.title,
});

const applied = applyPatch(before, patch);
assert.ok(applied.ok, "el parche tiene que aplicar");
assert.deepEqual(applied.guion, after, "parche aplicado = guion corregido");
assert.ok(guionLargoSchema.safeParse(applied.guion).success, "el resultado pasa el schema largo");

const size = (v: unknown) => JSON.stringify(v).length;
console.log(
  `OK · ${changedScenes.length} de ${before.scenes.length} escenas cambian · parche ${size(patch)} caracteres vs guion entero ${size(after)} (${Math.round((100 * size(patch)) / size(after))}%)`,
);

// Casos que tienen que fallar con un mensaje claro.
const one = patch.scenes[0];
assert.ok(one);
const far = applyPatch(before, {
  ...patch,
  scenes: [{ n: before.scenes.length + 2, scene: one.scene }],
});
assert.ok(!far.ok && far.errors[0]?.includes("solo se puede sumar"), "escena fuera de rango");
const dup = applyPatch(before, { ...patch, scenes: [one, one] });
assert.ok(!dup.ok && dup.errors[0]?.includes("dos veces"), "escena repetida");
const appended = applyPatch(before, {
  scenes: [{ n: before.scenes.length + 1, scene: one.scene }],
});
assert.ok(
  appended.ok && appended.guion.scenes.length === before.scenes.length + 1,
  "sumar al final",
);
console.log("OK · casos de error y de escena nueva");
