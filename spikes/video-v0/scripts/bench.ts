// V0-1: mide el render de Remotion en esta máquina.
// Uso: pnpm --filter @radev/spike-video-v0 bench [--runs 3] [--conc 2,4,6] [--seconds 30] [--label x]
// Escribe out/results.jsonl (una línea por corrida) y deja los MP4 en out/.
import { execFile } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { cpus } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "out");
mkdirSync(outDir, { recursive: true });

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
const runs = Number(arg("runs", "3"));
const concurrencies = arg("conc", "2,4,6").split(",").map(Number);
const seconds = Number(arg("seconds", "30"));
const label = arg("label", "solo");

// --- Muestreo del sistema -------------------------------------------------
const memUsedMiB = () => {
  const m = Object.fromEntries(
    readFileSync("/proc/meminfo", "utf8")
      .trim()
      .split("\n")
      .map((l) => {
        const [k, v] = l.split(":");
        return [k, Number.parseInt(v ?? "0", 10)];
      }),
  ) as Record<string, number>;
  const used = (m.MemTotal ?? 0) - (m.MemAvailable ?? 0);
  const swap = (m.SwapTotal ?? 0) - (m.SwapFree ?? 0);
  return { ram: Math.round(used / 1024), swap: Math.round(swap / 1024) };
};

const cpuTimes = () => {
  const [line] = readFileSync("/proc/stat", "utf8").split("\n");
  const n = (line ?? "").trim().split(/\s+/).slice(1).map(Number);
  const idle = (n[3] ?? 0) + (n[4] ?? 0);
  const total = n.reduce((a, b) => a + b, 0);
  return { idle, total };
};

// Memoria de Windows y temperatura de la GPU: procesos externos, cada 3 s.
const windowsUsedMiB = async () => {
  try {
    const { stdout } = await run("powershell.exe", [
      "-NoProfile",
      "-Command",
      "$o=Get-CimInstance Win32_OperatingSystem; [int](($o.TotalVisibleMemorySize-$o.FreePhysicalMemory)/1024)",
    ]);
    return Number.parseInt(stdout.trim(), 10);
  } catch {
    return null;
  }
};
const gpuTempC = async () => {
  try {
    const { stdout } = await run("nvidia-smi", ["--query-gpu=temperature.gpu", "--format=csv,noheader"]);
    return Number.parseInt(stdout.trim(), 10);
  } catch {
    return null;
  }
};

const sampler = () => {
  const s = { ramPeak: 0, swapPeak: 0, winPeak: 0, gpuTempPeak: 0, cpuSamples: [] as number[] };
  let prev = cpuTimes();
  const fast = setInterval(() => {
    const m = memUsedMiB();
    s.ramPeak = Math.max(s.ramPeak, m.ram);
    s.swapPeak = Math.max(s.swapPeak, m.swap);
    const now = cpuTimes();
    const dt = now.total - prev.total;
    if (dt > 0) s.cpuSamples.push(Math.round(100 * (1 - (now.idle - prev.idle) / dt)));
    prev = now;
  }, 500);
  let busy = false;
  const slow = setInterval(async () => {
    if (busy) return;
    busy = true;
    const [w, t] = await Promise.all([windowsUsedMiB(), gpuTempC()]);
    if (w) s.winPeak = Math.max(s.winPeak, w);
    if (t) s.gpuTempPeak = Math.max(s.gpuTempPeak, t);
    busy = false;
  }, 3000);
  return {
    stop: () => {
      clearInterval(fast);
      clearInterval(slow);
      const c = s.cpuSamples;
      return {
        ramPeakMiB: s.ramPeak,
        swapPeakMiB: s.swapPeak,
        windowsPeakMiB: s.winPeak || null,
        gpuTempPeakC: s.gpuTempPeak || null,
        cpuAvgPct: c.length ? Math.round(c.reduce((a, b) => a + b, 0) / c.length) : null,
        cpuMaxPct: c.length ? Math.max(...c) : null,
      };
    },
  };
};

// --- Bundle (en frío y con caché) ----------------------------------------
const entry = path.join(root, "src/index.ts");
const timeBundle = async (enableCaching: boolean) => {
  const t = performance.now();
  const url = await bundle({ entryPoint: entry, enableCaching });
  return { url, ms: Math.round(performance.now() - t) };
};

const baseline = { ...memUsedMiB(), windowsMiB: await windowsUsedMiB(), gpuTempC: await gpuTempC() };
console.log("línea base", baseline);

const cold = await timeBundle(false);
const warm = await timeBundle(true);
console.log(`bundle: en frío ${cold.ms} ms, con caché ${warm.ms} ms`);
const serveUrl = warm.url;

const composition = await selectComposition({ serveUrl, id: "short", inputProps: { seconds } });

for (const concurrency of concurrencies) {
  for (let i = 1; i <= runs; i++) {
    const file = path.join(outDir, `short-${seconds}s-c${concurrency}-${label}-${i}.mp4`);
    const sample = sampler();
    const t = performance.now();
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: file,
      inputProps: { seconds },
      concurrency,
    });
    const renderMs = Math.round(performance.now() - t);
    const sys = sample.stop();
    const result = {
      date: new Date().toISOString(),
      machine: "casa-ubuntu",
      label,
      seconds,
      concurrency,
      run: i,
      renderS: renderMs / 1000,
      renderSPerVideoS: Number((renderMs / 1000 / seconds).toFixed(2)),
      mp4MiB: Number((statSync(file).size / 1024 / 1024).toFixed(2)),
      bundleColdMs: cold.ms,
      bundleWarmMs: warm.ms,
      threads: cpus().length,
      baseline,
      ...sys,
    };
    appendFileSync(path.join(outDir, "results.jsonl"), `${JSON.stringify(result)}\n`);
    console.log(
      `c=${concurrency} #${i}: ${result.renderS} s (${result.renderSPerVideoS} s/s), RAM pico ${sys.ramPeakMiB} MiB, CPU ${sys.cpuAvgPct} %, GPU ${sys.gpuTempPeakC} °C`,
    );
  }
}
