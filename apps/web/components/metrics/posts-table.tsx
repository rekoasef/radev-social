import { engagementRate, type MetricsPost } from "@radev/core";
import type { MetricsPostRow } from "@radev/db";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { mediaUrl } from "@/lib/brand-assets";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "./format";

// Every post of the range with its counts: the table view of the charts (dataviz: every value a
// tooltip shows is reachable without hovering).

export const POST_SORTS = {
  recent: "Recientes",
  views: "Más vistas",
  engagement: "Más interacción",
} as const;
export type PostSort = keyof typeof POST_SORTS;

export function isPostSort(value: unknown): value is PostSort {
  return typeof value === "string" && Object.hasOwn(POST_SORTS, value);
}

export function sortPosts(rows: readonly MetricsPostRow[], sort: PostSort): MetricsPostRow[] {
  const list = [...rows];
  switch (sort) {
    case "views":
      return list.sort((a, b) => b.views - a.views);
    case "engagement":
      return list.sort((a, b) => (engagementRate(b) ?? -1) - (engagementRate(a) ?? -1));
    case "recent":
      return list.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  }
}

export function toMetricsPost(row: MetricsPostRow): MetricsPost {
  return {
    id: row.id,
    publishedAt: row.publishedAt,
    code: row.code,
    pillar: row.pillar,
    hookType: row.hookType,
    model: row.model,
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
  };
}

export type PostOutcome = { clicks: number; leads: number; clients: number };

export function PostsTable({
  rows,
  timeZone,
  medianViews,
  outcomes,
}: {
  rows: MetricsPostRow[];
  timeZone: string;
  /** Clicks on the links page and leads of each post. */
  outcomes: ReadonlyMap<string, PostOutcome>;
  /** Posts above it are marked: they did better than the usual post of the range. */
  medianViews: number | null;
}) {
  const outcomeOf = (id: string) => outcomes.get(id) ?? { clicks: 0, leads: 0, clients: 0 };
  return (
    <>
      {/* Phone: one card per post, the four counts in a row. */}
      <ul className="flex flex-col divide-y divide-bezel rounded-md border border-bezel md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex gap-3 px-4 py-4">
            <Cover row={row} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="line-clamp-2 text-sm text-ink">{row.caption || "Sin descripción"}</p>
              <PostMeta row={row} />
              <dl className="grid grid-cols-3 gap-2 text-xs">
                {(
                  [
                    ["Vistas", row.views],
                    ["Likes", row.likes],
                    ["Coment.", row.comments],
                    ["Compart.", row.shares],
                    ["Clics", outcomeOf(row.id).clicks],
                    ["Leads", outcomeOf(row.id).leads],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <dt className="text-ink-faint">{label}</dt>
                    <dd
                      className={cn(
                        "timecode",
                        label === "Vistas" && medianViews !== null && value > medianViews
                          ? "font-semibold text-ink"
                          : "text-ink-dim",
                      )}
                    >
                      {formatNumber(value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="timecode text-xs text-ink-faint">
                {formatDateTime(row.publishedAt, timeZone)} · {formatPercent(engagementRate(row))}{" "}
                interacción
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-md border border-bezel md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-panel text-left">
            <tr className="plate-text text-ink-faint">
              <th scope="col" className="px-4 py-3 font-medium">
                Post
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Publicado
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Vistas
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Likes
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Coment.
              </th>
              <th scope="col" className="px-3 py-3 text-right font-medium">
                Compart.
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Interacción
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const above = medianViews !== null && row.views > medianViews;
              return (
                <tr key={row.id} className="border-t border-bezel align-top hover:bg-panel/60">
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Cover row={row} />
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <p className="line-clamp-2 max-w-[46ch] text-ink" title={row.caption}>
                          {row.caption || "Sin descripción"}
                        </p>
                        <PostMeta row={row} />
                      </div>
                    </div>
                  </td>
                  <td className="timecode px-3 py-3 whitespace-nowrap text-ink-dim">
                    {formatDateTime(row.publishedAt, timeZone)}
                  </td>
                  <td
                    className={cn(
                      "timecode px-3 py-3 text-right",
                      above ? "font-semibold text-ink" : "text-ink-dim",
                    )}
                  >
                    {formatNumber(row.views)}
                  </td>
                  <td className="timecode px-3 py-3 text-right text-ink-dim">
                    {formatNumber(row.likes)}
                  </td>
                  <td className="timecode px-3 py-3 text-right text-ink-dim">
                    {formatNumber(row.comments)}
                  </td>
                  <td className="timecode px-3 py-3 text-right text-ink-dim">
                    {formatNumber(row.shares)}
                  </td>
                  <td className="timecode px-4 py-3 text-right text-ink-dim">
                    {formatPercent(engagementRate(row))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Cover({ row }: { row: MetricsPostRow }) {
  return (
    <div className="h-[60px] w-12 shrink-0 overflow-hidden rounded-[3px] bg-panel-raised">
      {row.coverPath && (
        // biome-ignore lint/performance/noImgElement: covers are local media files
        <img
          src={mediaUrl(row.coverPath)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

function PostMeta({ row }: { row: MetricsPostRow }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
      {row.code ? (
        <Link href={`/posts/${row.code}`} className="callsign py-0.5 text-[11px]">
          {row.code}
        </Link>
      ) : (
        <span>Fuera del sistema</span>
      )}
      {row.pillar && <span>{row.pillar}</span>}
      {row.url && (
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-ink-dim hover:text-ink"
        >
          TikTok <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      )}
    </p>
  );
}
