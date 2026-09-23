// Runs a command with the repo root .env loaded (if it exists). Variables already set in the
// environment win, so in Docker the container's variables are used.
// Usage: node scripts/with-root-env.mjs <command> [...args]
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Uso: node scripts/with-root-env.mjs <comando> [...args]");
  process.exit(1);
}

const child = spawn(command, args, { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
