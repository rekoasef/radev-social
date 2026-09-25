// Real data for the content (CLAUDE.md, rule 9; docs/ARCHITECTURE.md §6, `data.refresh`): the
// numbers a carousel may show come from here, never from the model. Each source (today only
// Bluelytics) turns its latest snapshot into datasets for `chart` slides and figures for
// `bigNumber` slides. Which sources a brand uses lives in the brand (`brands.data_sources`).

export const DATA_SOURCES = ["bluelytics"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  bluelytics: "Bluelytics: dólar blue y oficial",
};

export function isDataSource(value: string): value is DataSource {
  return (DATA_SOURCES as readonly string[]).includes(value);
}

/**
 * Points for a `chart` slide. Same shape as `chartDatasetSchema` (packages/slides) plus what the
 * AI and the editor need to pick it: a title and where it comes from.
 */
export type DataSeries = {
  title: string;
  source: string;
  unit?: string;
  unitPosition: "before" | "after";
  points: { label: string; value: number }[];
};

/** A figure a `bigNumber` slide may show, already written as it goes on the slide. */
export type DataFigure = { key: string; label: string; value: string; source: string };

/** What a brand's sources say today: the file `data.json` the AI reads. */
export type BrandData = {
  /** Date of the data (YYYY-MM-DD), the newest of the sources. */
  asOf: string;
  datasets: Record<string, DataSeries>;
  figures: DataFigure[];
};

/** The data of several sources as one. Null when there is none. */
export function combineBrandData(parts: readonly BrandData[]): BrandData | null {
  if (parts.length === 0) return null;
  return {
    asOf: parts.map((part) => part.asOf).reduce((a, b) => (a > b ? a : b)),
    datasets: Object.assign({}, ...parts.map((part) => part.datasets)),
    figures: parts.flatMap((part) => part.figures),
  };
}

/** A figure as written, for comparing: no case, no spaces, one kind of minus. */
function normalizeFigure(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, "");
}

/**
 * The figure a `bigNumber` value shows, if it is one of the data. The unit "$" may be left out
 * ("1.560" is the same figure as "$ 1.560"): the label says what it is.
 */
export function findFigure(figures: readonly DataFigure[], value: string): DataFigure | undefined {
  const wanted = normalizeFigure(value);
  return figures.find((figure) => {
    const own = normalizeFigure(figure.value);
    return own === wanted || (own.startsWith("$") && own.slice(1) === wanted);
  });
}

/**
 * Datasets a new version keeps (docs/PROGRESS.md, phase 3 T11: data frozen per version). A chart
 * that was already in the previous version keeps its points, so a new render never contradicts
 * the text written with them; a new chart takes today's data. `missing`: charts with no data.
 */
export function versionDatasets(input: {
  refs: readonly string[];
  previous: Readonly<Record<string, DataSeries>> | null;
  current: Readonly<Record<string, DataSeries>> | null;
}): { datasets: Record<string, DataSeries>; missing: string[] } {
  const datasets: Record<string, DataSeries> = {};
  const missing: string[] = [];
  for (const ref of new Set(input.refs)) {
    const series = input.previous?.[ref] ?? input.current?.[ref];
    if (series) datasets[ref] = series;
    else missing.push(ref);
  }
  return { datasets, missing };
}

// Numbers in Argentine Spanish: "." for thousands, "," for decimals. By hand, like
// packages/slides/src/format.ts, so it never depends on the ICU data of the runtime.
export function formatDataNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole = "0", fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = value < 0 && Number(fixed) !== 0 ? "-" : "";
  return `${sign}${grouped}${fraction ? `,${fraction}` : ""}`;
}

/** "$ 1.560", with cents only when there are. */
export function formatPesos(value: number): string {
  return `$ ${formatDataNumber(value, Number.isInteger(value) ? 0 : 2)}`;
}

/** "+2,3 %", "-0,8 %", "0,0 %": a change, always with one decimal and its sign. */
export function formatChange(percent: number): string {
  const text = formatDataNumber(percent, 1);
  return `${percent > 0 && text !== "0,0" ? "+" : ""}${text} %`;
}

/** "25/09/2026" from "2026-09-25". */
export function formatDataDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
