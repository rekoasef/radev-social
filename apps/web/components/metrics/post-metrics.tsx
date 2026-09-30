import { engagementRate } from "@radev/core";
import type { getPostNetworkMetrics } from "@radev/db";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { formatDateTime } from "@/lib/time";
import { formatNumber, formatPercent } from "./format";
import { LineChart } from "./line-chart";

type Metrics = NonNullable<Awaited<ReturnType<typeof getPostNetworkMetrics>>>;

const shortDay = (day: string) => {
  const [, month, date] = day.split("-");
  return `${Number(date)}/${Number(month)}`;
};

/** A post's numbers on TikTok, once metrics.sync linked it: today's counts and how views grew. */
export function PostMetrics({
  metrics,
  timeZone,
  code,
}: {
  metrics: Metrics;
  timeZone: string;
  code: string;
}) {
  const { post, days } = metrics;
  const figures = [
    ["Vistas", formatNumber(post.views)],
    ["Likes", formatNumber(post.likes)],
    ["Comentarios", formatNumber(post.comments)],
    ["Compartidos", formatNumber(post.shares)],
    ["Interacción", formatPercent(engagementRate(post))],
  ] as const;
  return (
    <section aria-labelledby="post-metrics-heading" className="flex flex-col gap-6">
      <Plate id="post-metrics-heading" aside={`leído ${formatDateTime(post.metricsAt, timeZone)}`}>
        En TikTok
      </Plate>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {figures.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-2 rounded-md border border-bezel bg-panel px-4 py-4"
          >
            <dt className="plate-text text-ink-dim">{label}</dt>
            <dd className="text-2xl font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {days.length >= 2 && (
        <LineChart
          label={`Vistas de ${code} día por día`}
          unit="vistas"
          points={days.map((day) => ({ key: day.day, label: shortDay(day.day), value: day.views }))}
        />
      )}
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-dim">
        <span>Publicado el {formatDateTime(post.publishedAt, timeZone)}</span>
        {post.url && (
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-ink"
          >
            Ver en TikTok <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        )}
        <Link href="/metrics" className="hover:text-ink">
          Todas las métricas
        </Link>
      </p>
    </section>
  );
}
