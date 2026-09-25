import {
  type BrandData,
  type DataFigure,
  type DataSeries,
  formatChange,
  formatDataDate,
  formatPesos,
} from "./data";

// Bluelytics (api.bluelytics.com.ar): the dollar in Argentina, blue and official. `data.refresh`
// stores one snapshot a day (`data_snapshots`) with today's rates and the recent history; this
// turns it into the datasets and figures of the content.

export const BLUELYTICS_URLS = {
  latest: "https://api.bluelytics.com.ar/v2/latest",
  history: "https://api.bluelytics.com.ar/v2/evolution.json",
} as const;

/** Days of history a snapshot keeps: enough for a year back plus a margin. */
export const BLUELYTICS_HISTORY_DAYS = 400;

export const DOLLAR_KINDS = ["blue", "oficial"] as const;
export type DollarKind = (typeof DOLLAR_KINDS)[number];

export type DollarRate = { buy: number; sell: number };

/** A snapshot as stored (`data_snapshots.payload`), validated when it was fetched. */
export type BluelyticsSnapshot = {
  /** When Bluelytics last updated its rates (ISO, with offset). */
  lastUpdate: string;
  latest: Record<DollarKind, DollarRate>;
  /** One entry per business day and kind, oldest first. */
  history: { date: string; kind: DollarKind; buy: number; sell: number }[];
};

const KIND_NAMES: Record<DollarKind, string> = { blue: "Dólar blue", oficial: "Dólar oficial" };
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Days between two dates (YYYY-MM-DD), as calendar days. */
function daysBefore(date: string, days: number): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - days);
  return at.toISOString().slice(0, 10);
}

/** Only the last `BLUELYTICS_HISTORY_DAYS` days before `asOf`, oldest first. */
export function trimBluelyticsHistory(
  history: BluelyticsSnapshot["history"],
  asOf: string,
): BluelyticsSnapshot["history"] {
  const from = daysBefore(asOf, BLUELYTICS_HISTORY_DAYS);
  return history
    .filter((entry) => entry.date > from && entry.date <= asOf)
    .sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const change = (from: number, to: number) => ((to - from) / from) * 100;

/** The selling price of a kind on each day, oldest first. */
function sellByDay(snapshot: BluelyticsSnapshot, kind: DollarKind) {
  return snapshot.history
    .filter((entry) => entry.kind === kind)
    .map((entry) => ({ date: entry.date, sell: entry.sell }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The last selling price on or before a date. */
function sellOn(days: { date: string; sell: number }[], date: string): number | undefined {
  let found: number | undefined;
  for (const day of days) {
    if (day.date > date) break;
    found = day.sell;
  }
  return found;
}

export function bluelyticsData(snapshot: BluelyticsSnapshot): BrandData {
  const asOf = snapshot.lastUpdate.slice(0, 10);
  const source = `Bluelytics, ${formatDataDate(asOf)}`;
  const datasets: Record<string, DataSeries> = {};
  const figures: DataFigure[] = [];
  const monthAgo = daysBefore(asOf, 30);
  const yearAgo = daysBefore(asOf, 365);

  for (const kind of DOLLAR_KINDS) {
    const days = sellByDay(snapshot, kind);
    const name = KIND_NAMES[kind];

    const recent = days.filter((day) => day.date > monthAgo);
    if (recent.length >= 2) {
      datasets[`usd-${kind}-30d`] = {
        title: `${name} (venta), día por día en los últimos 30 días`,
        source,
        unit: "$",
        unitPosition: "before",
        points: recent.map((day) => ({
          label: `${day.date.slice(8, 10)}/${day.date.slice(5, 7)}`,
          value: day.sell,
        })),
      };
    }

    // The last price of each of the last 12 months (the current one, so far).
    const months = new Map<string, number>();
    for (const day of days) {
      if (day.date > yearAgo) months.set(day.date.slice(0, 7), day.sell);
    }
    const monthly = [...months].slice(-12);
    if (monthly.length >= 2) {
      datasets[`usd-${kind}-12m`] = {
        title: `${name} (venta), cierre de cada mes en los últimos 12 meses`,
        source,
        unit: "$",
        unitPosition: "before",
        points: monthly.map(([month, sell]) => ({
          label: `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(2, 4)}`,
          value: sell,
        })),
      };
    }

    const rate = snapshot.latest[kind];
    figures.push(
      { key: `usd-${kind}-venta`, label: `${name}, venta`, value: formatPesos(rate.sell), source },
      { key: `usd-${kind}-compra`, label: `${name}, compra`, value: formatPesos(rate.buy), source },
    );
    for (const [key, date, period] of [
      ["30d", monthAgo, "en los últimos 30 días"],
      ["12m", yearAgo, "en los últimos 12 meses"],
    ] as const) {
      const before = sellOn(days, date);
      if (before === undefined || before <= 0) continue;
      figures.push({
        key: `usd-${kind}-var-${key}`,
        label: `Cuánto cambió el ${name.toLowerCase()} (venta) ${period}`,
        value: formatChange(change(before, rate.sell)),
        source,
      });
    }
  }

  // Gap between blue and official, on the days both have a price.
  const official = new Map(sellByDay(snapshot, "oficial").map((day) => [day.date, day.sell]));
  const gap = sellByDay(snapshot, "blue").flatMap((day) => {
    const base = official.get(day.date);
    return day.date > monthAgo && base ? [{ date: day.date, value: change(base, day.sell) }] : [];
  });
  if (gap.length >= 2) {
    datasets["brecha-30d"] = {
      title: "Brecha entre el dólar blue y el oficial (venta), en los últimos 30 días",
      source,
      unit: "%",
      unitPosition: "after",
      points: gap.map((day) => ({
        label: `${day.date.slice(8, 10)}/${day.date.slice(5, 7)}`,
        value: round1(day.value),
      })),
    };
  }
  if (snapshot.latest.oficial.sell > 0) {
    figures.push({
      key: "brecha",
      label: "Brecha entre el dólar blue y el oficial (venta)",
      value: formatChange(change(snapshot.latest.oficial.sell, snapshot.latest.blue.sell)).replace(
        /^\+/,
        "",
      ),
      source,
    });
  }

  return { asOf, datasets, figures };
}
