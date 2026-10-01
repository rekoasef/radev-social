import { formatCompact, formatPercent } from "./format";

// A ranking as horizontal bars: label, bar by median views, the value at the tip and how many posts
// back it (a group of one post is shown fainter: it says little yet).

export type RankRow = {
  key: string;
  label: string;
  medianViews: number | null;
  posts: number;
  engagement: number | null;
  /** Leads its posts brought (links page and typed leads). */
  leads?: number;
};

export function RankBars({ rows, empty }: { rows: RankRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-ink-faint">{empty}</p>;
  const max = Math.max(1, ...rows.map((row) => row.medianViews ?? 0));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const share = (row.medianViews ?? 0) / max;
        return (
          <li
            key={row.key}
            className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,11rem)_1fr_auto]"
            style={{ opacity: row.posts > 1 ? 1 : 0.6 }}
          >
            <span className="truncate text-sm text-ink" title={row.label}>
              {row.label}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 flex-1">
                <span
                  className="block h-full rounded-r-[4px]"
                  style={{
                    width: `${Math.max(2, share * 100)}%`,
                    background: "var(--chart-ours)",
                  }}
                />
              </span>
              <span className="timecode w-14 text-right text-sm text-ink">
                {row.medianViews === null ? "—" : formatCompact(row.medianViews)}
              </span>
            </span>
            <span className="col-start-2 text-xs text-ink-faint sm:col-start-auto sm:w-52 sm:text-right">
              {row.posts} {row.posts === 1 ? "post" : "posts"} · {formatPercent(row.engagement)}{" "}
              interacción
              {row.leads ? ` · ${row.leads} ${row.leads === 1 ? "lead" : "leads"}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
