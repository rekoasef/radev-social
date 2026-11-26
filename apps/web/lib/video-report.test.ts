import { describe, expect, it } from "vitest";
import { videoReport } from "./video-report";

const run = (task: string, status = "succeeded") => ({
  task,
  status,
  inputTokens: 1000,
  outputTokens: 100,
  durationMs: 5000,
});

describe("videoReport", () => {
  const { rows, total } = videoReport({
    runs: [run("video.script", "failed"), run("video.script"), run("video.review")],
    usage: [
      { kind: "tts", office: "voicing", quantity: 1917, durationMs: 12_000 },
      { kind: "office", office: "scripting", quantity: 90, durationMs: 90_000 },
      { kind: "office", office: "scripting", quantity: 30, durationMs: 30_000 },
      { kind: "office", office: "voicing", quantity: 12, durationMs: 12_000 },
    ],
    notes: { finding_images: "34 candidatas" },
  });

  it("adds up every run of an office, failed ones included", () => {
    expect(rows[3]).toMatchObject({
      office: "4 Guion",
      spent: "2.000 / 200",
      ms: 120_000,
      notes: "2 corridas · 1 con error",
    });
  });

  it("shows the voice in credits and leaves unmeasured times empty", () => {
    expect(rows[5]).toMatchObject({ spent: "1.917 créditos", ms: 12_000 });
    expect(rows[2]).toMatchObject({ spent: "—", ms: null, notes: "34 candidatas" });
  });

  it("totals tokens, time and voice", () => {
    expect(total).toMatchObject({
      who: "3 corridas de Claude",
      spent: "3.000 / 300",
      ms: 132_000,
      notes: "+ 1.917 créditos de voz",
    });
  });
});
