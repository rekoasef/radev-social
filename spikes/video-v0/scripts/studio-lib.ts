// Biblioteca del Estudio (ADR 0028): una pieza por archivo en studio/pieces/<pieza>.json, guardada
// en git (es parte del kit). Estados: pendiente (dibujada, sin revisar), aprobada (entra al kit),
// rechazada (con el motivo, para redibujarla).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Usage } from "@radev/ai";
import type { ExtraPieces } from "../src/anim/kit-catalog";
import type { StudioPiece } from "../src/anim/studio-format";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const STUDIO_DIR = path.join(ROOT, "studio", "pieces");

export type Status = "pendiente" | "aprobada" | "rechazada";
export type Entry = {
  status: Status;
  piece: StudioPiece;
  /** Motivos de los rechazos del operador, en orden (el último manda). */
  feedback?: string[];
  /** De qué guion salió el pedido. */
  origin?: string;
  createdAt: string;
  updatedAt: string;
  usage?: Usage | null;
};

const file = (kind: string) => path.join(STUDIO_DIR, `${kind}.json`);

export function loadLibrary(): Entry[] {
  if (!existsSync(STUDIO_DIR)) return [];
  return readdirSync(STUDIO_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(STUDIO_DIR, f), "utf8")) as Entry)
    .sort((a, b) => a.piece.kind.localeCompare(b.piece.kind));
}

export function getEntry(kind: string): Entry | undefined {
  return existsSync(file(kind))
    ? (JSON.parse(readFileSync(file(kind), "utf8")) as Entry)
    : undefined;
}

export function saveEntry(entry: Entry) {
  mkdirSync(STUDIO_DIR, { recursive: true });
  writeFileSync(file(entry.piece.kind), `${JSON.stringify(entry, null, 1)}\n`);
}

/** Las piezas aprobadas, listas para el render. */
export function approvedPieces(): Record<string, StudioPiece> {
  return Object.fromEntries(
    loadLibrary()
      .filter((e) => e.status === "aprobada")
      .map((e) => [e.piece.kind, e.piece]),
  );
}

/** Lo que el guion puede usar sin pedirlo de nuevo: aprobadas y pendientes (las pendientes
 * frenan el render hasta que el operador las apruebe). */
export function knownPieces(): ExtraPieces {
  return Object.fromEntries(
    loadLibrary()
      .filter((e) => e.status !== "rechazada")
      .map((e) => [e.piece.kind, e.piece]),
  );
}
