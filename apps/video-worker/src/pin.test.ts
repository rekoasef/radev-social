import { describe, expect, it, vi } from "vitest";
import { video } from "./offices/harness";
import { type PinDeps, pinImage } from "./pin";

const candidate = {
  id: "i07",
  title: "Louvre",
  description: "",
  date: "",
  author: "Atget",
  license: "Public domain",
  page: "https://commons.wikimedia.org/wiki/File:Louvre.jpg",
  file: "images/i07.jpg",
  width: 1280,
  height: 900,
};
const hit = {
  ...candidate,
  page: "https://commons.wikimedia.org/wiki/File:Peruggia.jpg",
  title: "Peruggia",
  score: 100,
  thumb: "https://upload.wikimedia.org/thumb/Peruggia.jpg",
};

function setup(over: Partial<PinDeps> = {}, stage: "script_review" | "voicing" = "script_review") {
  const saved: Record<string, unknown>[] = [];
  const files: string[] = [];
  const deps: PinDeps = {
    getVideo: async () => video({ stage }),
    images: async () => ({ candidates: [candidate] }),
    saveImages: async (_id, data) => {
      saved.push(data);
    },
    commons: {
      fileByTitle: vi.fn(async () => hit),
      download: vi.fn(async () => Buffer.from("jpg")),
    },
    shrink: async (bytes) => bytes,
    sizeOf: () => ({ width: 1280, height: 800 }),
    write: async (_id, path) => {
      files.push(path);
    },
    ...over,
  };
  return { deps, saved, files };
}
const job = { videoId: "v1", title: "Peruggia.jpg" };

describe("pinImage", () => {
  it("adds one candidate with the next id, its file and its small copy", async () => {
    const { deps, saved, files } = setup();
    expect(await pinImage(deps, job)).toMatchObject({ ok: true, imageId: "i08" });
    expect(files).toEqual(["images/i08.jpg", "images/i08.small.jpg"]);
    expect(saved[0]).toMatchObject({ candidates: [{ id: "i07" }, { id: "i08", height: 800 }] });
  });

  it("does not add or download an image that is already there (rule 8)", async () => {
    const { deps, saved } = setup({
      commons: { fileByTitle: async () => ({ ...hit, page: candidate.page }), download: vi.fn() },
    });
    expect(await pinImage(deps, job)).toMatchObject({ ok: true, imageId: "i07" });
    expect(deps.commons.download).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it("explains why a file cannot be used", async () => {
    const { deps } = setup({ commons: { fileByTitle: async () => null, download: vi.fn() } });
    expect(await pinImage(deps, job)).toMatchObject({
      ok: false,
      message: expect.stringContaining("licencia"),
    });
  });

  it("does nothing once the script left the desk", async () => {
    const { deps, saved } = setup({}, "voicing");
    expect((await pinImage(deps, job)).ok).toBe(false);
    expect(saved).toEqual([]);
  });
});
