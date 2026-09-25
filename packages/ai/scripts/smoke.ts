// Real run of a provider (phase 3, T4–T5): a tiny generation with the operator's credentials
// from the root .env. It never prints them.
// Usage: pnpm --filter @radev/ai smoke [claude-code|openrouter] [model]
//   defaults: claude-code with sonnet; openrouter with nvidia/nemotron-3-super-120b-a12b:free
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { claudeCredential, createClaudeCodeProvider, createOpenRouterProvider } from "../src";

const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const providerId = process.argv[2] ?? "claude-code";
if (providerId !== "claude-code" && providerId !== "openrouter") {
  console.error("Proveedor desconocido. Usá claude-code u openrouter.");
  process.exit(1);
}

let provider: ReturnType<typeof createClaudeCodeProvider>;
let model: string;
if (providerId === "claude-code") {
  const credential = claudeCredential(process.env);
  console.log(`Credencial: ${credential ? credential.name : "ninguna"}`);
  provider = createClaudeCodeProvider();
  model = process.argv[3] ?? "sonnet";
} else {
  console.log(`Credencial: ${process.env.OPENROUTER_API_KEY ? "OPENROUTER_API_KEY" : "ninguna"}`);
  provider = createOpenRouterProvider();
  model = process.argv[3] ?? "nvidia/nemotron-3-super-120b-a12b:free";
}

const schema = z.object({
  hook: z.string().min(1).max(80),
  pillarKey: z.enum(["tips", "cases"]),
});

console.log(`Generando con ${providerId} (${model})…`);

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
      `${numTurns ?? "?"} turnos · ${(durationMs / 1000).toFixed(1)} s · precio USD ${costUsd ?? "?"}`,
  );
}
process.exit(result.ok ? 0 : 1);
