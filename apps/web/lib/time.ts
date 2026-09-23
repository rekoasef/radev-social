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
