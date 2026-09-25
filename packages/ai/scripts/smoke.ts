// Real run of the claude-code provider (phase 3, T4): a tiny generation with the operator's
// credential from the root .env, in an isolated workspace. It never prints the credential.
// Usage: pnpm --filter @radev/ai smoke [model]   (default: sonnet)
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { claudeCredential, createClaudeCodeProvider } from "../src";

const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const credential = claudeCredential(process.env);
console.log(`Credencial: ${credential ? credential.name : "ninguna"}`);

const schema = z.object({
  hook: z.string().min(1).max(80),
  pillarKey: z.enum(["tips", "cases"]),
});

const model = process.argv[2] ?? "sonnet";
const provider = createClaudeCodeProvider();
console.log(`Generando con claude-code (${model})…`);

const result = await provider.generate({
  task: "carousel.generate",
  brandId: "smoke",
  prompt: "Leé task.json y devolvé el objeto que pide el schema.",
  files: {
    "CLAUDE.md":
      "# Marca de prueba\n\nEscribís en español rioplatense con voseo, frases cortas.\n" +
      "Nunca inventes números.\n",
    "task.json": JSON.stringify({
      idea: "Por qué conviene automatizar las respuestas de WhatsApp de un negocio",
      pillarKey: "tips",
    }),
  },
  schema,
  model,
  maxTurns: 4,
  timeoutMs: 3 * 60_000,
});

if (result.ok) {
  console.log("OK:", result.data);
} else {
  console.log(`Error (${result.error.kind}): ${result.error.message}`);
  if (result.error.kind === "validation") console.log(result.error.issues);
}
if (result.usage) {
  const { model: used, inputTokens, outputTokens, durationMs, numTurns, costUsd } = result.usage;
  console.log(
    `Modelo: ${used} · tokens ${inputTokens} entrada / ${outputTokens} salida · ` +
      `${numTurns ?? "?"} turnos · ${(durationMs / 1000).toFixed(1)} s · precio de lista USD ${costUsd ?? "?"} (no se cobra con la suscripción)`,
  );
}
process.exit(result.ok ? 0 : 1);
