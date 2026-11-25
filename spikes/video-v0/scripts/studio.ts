// Estudio (ADR 0028): la IA dibuja las piezas que el kit no tiene y el operador las aprueba.
//   pnpm studio draw <guion.json> [--redo]       dibuja las `newPieces` del guion que falten
//   pnpm studio draw-one <pieza> "<cómo es>" <piso|pared|techo|sobre> <ancho> <alto> [--surface N]
//   pnpm studio list                             la biblioteca y el estado de cada pieza
//   pnpm studio sheet [--all]                    hoja con las pendientes (o todas) → out/studio
//   pnpm studio approve <pieza...>               entran al kit
//   pnpm studio reject <pieza> "<motivo>"        la próxima `draw` la redibuja con el motivo
// --model <alias> (sonnet por defecto) · --effort <low|medium|high>
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClaudeCodeProvider, resolveClaudeBin } from "@radev/ai";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { guionLargoSchema } from "../src/anim/schema";
import type { SheetItem } from "../src/anim/studio-draw";
import {
  checkStudioPiece,
  DRAWING_EXAMPLES,
  type NewPiece,
  newPieceSchema,
  PALETTE,
  studioPieceSchema,
} from "../src/anim/studio-format";
import { type Entry, getEntry, loadLibrary, ROOT, saveEntry } from "./studio-lib";

const envFile = path.resolve(ROOT, "..", "..", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const out = path.join(ROOT, "out", "studio");
mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const value = args[i + 1];
  args.splice(i, value && !value.startsWith("--") ? 2 : 1);
  return value ?? "";
};
const model = flag("model") ?? "sonnet";
const effort = flag("effort");
const redo = flag("redo") !== undefined;
const all = flag("all") !== undefined;
const surface = flag("surface");
const [mode, ...rest] = args;

function provider() {
  if (!effort) return createClaudeCodeProvider({});
  const bin = path.join(out, `claude-effort-${effort}.sh`);
  writeFileSync(
    bin,
    `#!/bin/sh\nexec ${JSON.stringify(resolveClaudeBin())} --effort ${effort} "$@"\n`,
  );
  chmodSync(bin, 0o755);
  return createClaudeCodeProvider({ bin });
}

const STYLE = `# Dibujante del Estudio

Dibujás UNA pieza para el kit de escenarios de videos animados verticales: estilo plano tipo motion graphics, formas simples y redondeadas, sin contornos negros, volumen con un tono más oscuro de un lado y un brillo con uno más claro. La pieza va sobre paredes oscuras (azul noche, violeta, gris) junto a personajes simples.

Devolvés DATOS (formas), no código ni SVG:
- \`rect\` (x, y, w, h, r), \`circle\` (cx, cy, r), \`ellipse\` (cx, cy, rx, ry), \`path\` (d), cada una con \`fill\` (un color de la paleta o "none"), y opcionales \`stroke\`, \`strokeWidth\`, \`opacity\` y \`group\`.
- **La base de la pieza está en (0, 0) y sube en negativo**: x entre -w/2 y w/2, y entre -h y 0 (\`w\` y \`h\` en \`pedido.json\`). Lo que se apoya en el piso toca y = 0. Usá casi todo ese espacio.
- \`path\` solo con comandos ABSOLUTOS en mayúsculas (M L H V C Q S T A Z) y números.
- **Solo colores de la paleta**: ${Object.keys(PALETTE).join(", ")}.
- **12 a 45 formas**, en orden de dibujo: primero la silueta grande, después volúmenes y sombras, al final los detalles. Nada más fino que 6 px.
- **Sin texto, letras ni números**, ni formas que los dibujen (un cartel va liso o con un ícono simple).
- **Algo vivo**: 1 a 3 \`groups\` con movimiento SUTIL (una luz que titila, algo que se mece, flota, gira o late), y las formas que se mueven llevan ese \`group\`. Para \`mecer\`, \`girar\` y \`latir\`, poné el pivote (\`pivotX\`, \`pivotY\`) donde la pieza se agarra.
- Que se reconozca al primer vistazo aunque se vea chica: silueta clara y lo característico exagerado.

\`ejemplos.json\` tiene dos piezas del kit en este formato.`;

async function draw(req: NewPiece, entry: Entry | undefined, origin?: string) {
  const p = provider();
  const feedback = entry?.status === "rechazada" ? (entry.feedback ?? []) : [];
  let errors: string[] = [];
  let previous: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const notes = [
      feedback.length > 0
        ? `\n\nEl operador rechazó el dibujo anterior (\`anterior.json\`). Motivo: ${feedback.at(-1)}. Hacelo de nuevo teniéndolo en cuenta.`
        : "",
      errors.length > 0
        ? `\n\nEl intento anterior (\`anterior.json\`) tuvo estos errores; corregilos:\n${errors.map((e) => `- ${e}`).join("\n")}`
        : "",
    ].join("");
    const before = previous ?? (feedback.length > 0 ? entry?.piece : undefined);
    console.log(
      `→ ${req.kind} (intento ${attempt}, ${model}${effort ? `, effort ${effort}` : ""})…`,
    );
    const result = await p.generate({
      task: "carousel.generate", // la spike no suma tareas a core; en V1 sería video.studio
      brandId: "spike-video",
      model,
      prompt: `Dibujá la pieza de \`pedido.json\`.${notes}\nDevolvé el objeto que pide el schema.`,
      files: {
        "CLAUDE.md": STYLE,
        "ejemplos.json": JSON.stringify(Object.values(DRAWING_EXAMPLES)),
        "pedido.json": JSON.stringify(req),
        ...(before ? { "anterior.json": JSON.stringify(before) } : {}),
      },
      schema: studioPieceSchema,
      maxTurns: 3,
      timeoutMs: 5 * 60_000,
    });
    const u = result.usage;
    console.log(
      u
        ? `  ${u.inputTokens} entrada / ${u.outputTokens} salida · ${(u.durationMs / 1000).toFixed(1)} s · lista USD ${u.costUsd?.toFixed(3) ?? "?"}`
        : "  sin uso",
    );
    if (!result.ok) {
      errors = [`${result.error.kind}: ${result.error.message}`];
      console.log(`  ${errors[0]}`);
      continue;
    }
    previous = result.data;
    errors = checkStudioPiece(req, result.data);
    for (const e of errors) console.log(`  ✗ ${e}`);
    if (errors.length > 0) continue;
    const now = new Date().toISOString();
    const saved: Entry = {
      status: "pendiente",
      piece: { ...req, ...result.data },
      ...(feedback.length > 0 && { feedback }),
      ...(origin && { origin }),
      createdAt: entry?.createdAt ?? now,
      updatedAt: now,
      usage: u,
    };
    saveEntry(saved);
    console.log(`  ✓ ${req.kind}: pendiente de aprobación`);
    return saved;
  }
  console.log(`  ✗ ${req.kind}: no salió en 3 intentos`);
  return undefined;
}

async function sheet(items: SheetItem[], name: string) {
  if (items.length === 0) return console.log("No hay piezas para mostrar.");
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts") });
  const browser = await openBrowser("chrome", {
    chromiumOptions: { flags: { "font-render-hinting": false } },
  });
  const inputProps = { items };
  const composition = await selectComposition({
    serveUrl,
    id: "studio-sheet",
    inputProps,
    puppeteerInstance: browser,
  });
  const file = path.join(out, `${name}.png`);
  await renderStill({
    composition,
    serveUrl,
    inputProps,
    frame: 30,
    output: file,
    puppeteerInstance: browser,
  });
  await browser.close({ silent: true });
  console.log(`hoja → ${file}`);
}

const toItem = (e: Entry): SheetItem => ({ piece: e.piece, status: e.status });

if (mode === "draw" && rest[0]) {
  const g = guionLargoSchema.parse(
    (JSON.parse(readFileSync(path.resolve(rest[0]), "utf8")) as { guion: unknown }).guion,
  );
  const drawn: Entry[] = [];
  for (const req of g.newPieces ?? []) {
    const entry = getEntry(req.kind);
    if (entry && entry.status !== "rechazada" && !redo) {
      console.log(`· ${req.kind}: ya está (${entry.status})`);
      continue;
    }
    const e = await draw(req, entry, rest[0]);
    if (e) drawn.push(e);
  }
  await sheet(drawn.map(toItem), "nuevas");
} else if (mode === "draw-one" && rest.length >= 5) {
  const [kind, what, where, w, h] = rest;
  const req = newPieceSchema.parse({
    kind,
    what,
    where,
    w: Number(w),
    h: Number(h),
    ...(surface && { surface: Number(surface) }),
  });
  const e = await draw(req, getEntry(req.kind));
  if (e) await sheet([toItem(e)], req.kind);
} else if (mode === "list") {
  const lib = loadLibrary();
  if (lib.length === 0) console.log("La biblioteca del Estudio está vacía.");
  for (const e of lib) {
    console.log(
      `${e.status.padEnd(10)} ${e.piece.kind.padEnd(24)} ${`${e.piece.w}×${e.piece.h}`.padEnd(9)} ${e.piece.where.padEnd(6)} ${e.piece.what}`,
    );
    if (e.status === "rechazada") console.log(`           motivo: ${e.feedback?.at(-1)}`);
  }
} else if (mode === "sheet") {
  const lib = loadLibrary().filter((e) => all || e.status === "pendiente");
  await sheet(lib.map(toItem), all ? "estudio" : "pendientes");
} else if (mode === "approve" && rest.length > 0) {
  for (const kind of rest) {
    const e = getEntry(kind);
    if (!e) {
      console.log(`✗ ${kind}: no está en el Estudio`);
      continue;
    }
    saveEntry({ ...e, status: "aprobada", updatedAt: new Date().toISOString() });
    console.log(`✓ ${kind}: aprobada, ya es parte del kit`);
  }
} else if (mode === "reject" && rest[0] && rest[1]) {
  const e = getEntry(rest[0]);
  if (!e) throw new Error(`${rest[0]}: no está en el Estudio`);
  saveEntry({
    ...e,
    status: "rechazada",
    feedback: [...(e.feedback ?? []), rest[1]],
    updatedAt: new Date().toISOString(),
  });
  console.log(
    `✗ ${rest[0]}: rechazada. La próxima \`pnpm studio draw\` la redibuja con tu motivo.`,
  );
} else {
  console.log(
    'Uso: pnpm studio draw <guion.json> [--redo] | draw-one <pieza> "<cómo es>" <piso|pared|techo|sobre> <ancho> <alto> [--surface N] | list | sheet [--all] | approve <pieza...> | reject <pieza> "<motivo>"',
  );
}
