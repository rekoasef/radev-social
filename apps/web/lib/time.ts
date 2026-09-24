/** "America/Argentina/Buenos_Aires" -> "Buenos Aires". */
export function cityOf(timeZone: string): string {
  return (timeZone.split("/").at(-1) ?? timeZone).replaceAll("_", " ");
}

/** Current UTC offset of a time zone, e.g. "GMT-3". */
export function offsetOf(timeZone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(at);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
}

/** Short date and time in a brand's time zone, e.g. "24 sep 13:05" (CLAUDE.md, rule 11). */
export function formatDateTime(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")} ${get("month").replace(".", "")} ${get("hour")}:${get("minute")}`;
}
