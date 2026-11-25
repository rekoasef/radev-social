import { describe, expect, it } from "vitest";
import { cleanAuthor, creditLine, type ImageCandidate, licenseAllowed, shortCredit } from "../src";

const img = (over: Partial<ImageCandidate> = {}): ImageCandidate => ({
  id: "i01",
  title: "Vincenzo Perugia",
  description: "",
  date: "1911",
  author: "autor desconocido",
  license: "Public domain",
  page: "https://commons.wikimedia.org/wiki/File:x.jpg",
  file: "img/i01.jpg",
  width: 800,
  height: 1000,
  ...over,
});

describe("licenseAllowed", () => {
  it.each([
    "Public domain",
    "PD-old-100",
    "CC0",
    "CC BY 2.0",
    "CC BY-SA 3.0",
    "CC BY-SA 4.0",
    "No restrictions",
  ])("acepta %s", (l) => expect(licenseAllowed(l)).toBe(true));
  it.each(["CC BY-NC 2.0", "CC BY-ND 4.0", "CC BY-NC-SA 3.0", "Fair use", "All rights reserved"])(
    "rechaza %s",
    (l) => expect(licenseAllowed(l)).toBe(false),
  );
});

describe("cleanAuthor", () => {
  it("saca paréntesis, «Unknown author» y repeticiones", () => {
    expect(cleanAuthor("Unknown author")).toBe("");
    expect(cleanAuthor("Correggio Correggio")).toBe("Correggio");
    expect(cleanAuthor("Louis Béroud (1852–1930)")).toBe("Louis Béroud");
  });
});

describe("shortCredit y creditLine", () => {
  it("dominio público sin autor: solo qué es y la licencia", () => {
    expect(shortCredit(img())).toBe("Vincenzo Perugia · dominio público");
  });
  it("con autor que no está en el título, lo suma; con caption, reemplaza el título", () => {
    const c = img({ author: "Roger-Viollet", license: "CC BY-SA 4.0" });
    expect(shortCredit(c, "Foto de 1911")).toBe("Foto de 1911 · Roger-Viollet · CC BY-SA 4.0");
  });
  it("no repite el autor si ya está en el título", () => {
    expect(shortCredit(img({ title: "Atget - Port du Louvre", author: "Atget" }))).toBe(
      "Atget - Port du Louvre · dominio público",
    );
  });
  it("la línea de la descripción trae autor, licencia y página", () => {
    expect(creditLine(img())).toBe(
      "- Vincenzo Perugia — autor desconocido — Public domain — https://commons.wikimedia.org/wiki/File:x.jpg",
    );
  });
});
