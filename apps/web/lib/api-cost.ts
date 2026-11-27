// What Claude's runs would cost through the API, as `claude -p` reports it. With the subscription it is
// not paid: it is the fair way to compare runs, because the tokens add up the cache, which every turn
// sends again and costs a tenth.

const usd = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const API_COST_NOTE =
  "Claude: costo equivalente por API, como lo informa claude -p. Con la suscripción no se paga; sirve para comparar.";

/** «≈ USD 0,62»; «—» when nothing was reported. */
export function apiUsd(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value > 0 && value < 0.005) return "< USD 0,01";
  return `≈ USD ${usd.format(value)}`;
}
