export type ByteRange = { start: number; end: number };

/**
 * The `Range` header of a request for a file of `size` bytes. "full" means answer with the whole
 * file: no header, one we do not understand, or several ranges at once (HTTP lets a server ignore
 * them). "unsatisfiable" is a range that starts after the end (416).
 */
export function parseRange(
  header: string | null,
  size: number,
): ByteRange | "full" | "unsatisfiable" {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return "full";
  const [, from = "", to = ""] = match;
  if (from === "" && to === "") return "full";

  // "bytes=-500": the last 500 bytes.
  if (from === "") {
    const length = Math.min(Number(to), size);
    return length > 0 ? { start: size - length, end: size - 1 } : "unsatisfiable";
  }

  const start = Number(from);
  if (to !== "" && Number(to) < start) return "full";
  if (start >= size) return "unsatisfiable";
  return { start, end: to === "" ? size - 1 : Math.min(Number(to), size - 1) };
}
