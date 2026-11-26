import { describe, expect, it } from "vitest";
import type { ImageCandidate } from "./images";
import { dropSceneNameCards, imageNames } from "./name-cards";
import type { ScriptScene } from "./script";

const candidate = (id: string, title: string, description = "") =>
  ({ id, title, description }) as ImageCandidate;

// The three cases of the first real video.
const crew = candidate(
  "i03",
  "Crew of Northwest Airlines Flight 305 after D. B. Cooper hijacking",
  "From left to right: Captain William Scott, First Officer William Rataczak, Stewardess Tina Mucklow",
);
const tobacco = candidate("i21", "Cigar, smoking tobacco, cut tobacco, cigarettes, Raleigh");
const ticket = candidate("i01", "July 2016 D.B. Cooper Plane Ticket");

describe("imageNames", () => {
  it("accepts a person or place the image names, ignoring accents and case", () => {
    expect(imageNames(crew, "Tina Mucklow")).toBe(true);
    expect(imageNames(ticket, "Dan Cooper")).toBe(true);
    expect(imageNames(candidate("i02", "Musée du Louvre"), "Museo del Louvre")).toBe(true);
  });

  it("tolerates one letter of spelling, but not in short words", () => {
    expect(imageNames(candidate("i03", "Vincenzo Perugia"), "Vincenzo Peruggia")).toBe(true);
    expect(imageNames(candidate("i05", "Retrato de Rosa"), "Juan Sosa")).toBe(false);
  });

  it("refuses a person who is not in the description and a label the image never says", () => {
    expect(imageNames(crew, "Florence Schaffner")).toBe(false);
    expect(imageNames(tobacco, "Evidencia")).toBe(false);
  });
});

describe("dropSceneNameCards", () => {
  const card = (name: string) => ({
    kind: "nombre" as const,
    name,
    role: "x",
    pos: "abajo" as const,
    at: 0,
  });
  const scene = {
    image: "i03",
    graphics: [card("Florence Schaffner"), card("Tina Mucklow")],
  } as ScriptScene;

  it("removes only the unbacked card, without touching the scene it receives", () => {
    const result = dropSceneNameCards(scene, [crew]);
    expect(result.dropped).toEqual(["Florence Schaffner"]);
    expect(result.scene.graphics).toEqual([card("Tina Mucklow")]);
    expect(scene.graphics).toHaveLength(2);
  });

  it("removes every card when the image is not among the candidates", () => {
    expect(dropSceneNameCards(scene, []).scene.graphics).toEqual([]);
  });
});
