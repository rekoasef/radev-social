import {
  accountGrowth,
  addDays,
  byHour,
  byWeekday,
  groupPosts,
  isMetricsRange,
  localDateOf,
  METRICS_RANGES,
  type MetricsRange,
  summarize,
  WEEK_ORDER,
  WEEKDAY_SHORT,
  zonedToUtc,
} from "@radev/core";
import {
  countPostOutcomes,
  getLastMetricsAt,
  getLeadTotals,
  getSocialAccount,
  listAccountDays,
  listMetricsPosts,
} from "@radev/db";
import type { HookType } from "@radev/slides";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { ColumnChart, type ColumnItem } from "@/components/metrics/column-chart";
import {
  formatCompact,
  formatDelta,
  formatNumber,
  formatPercent,
} from "@/components/metrics/format";
import { LineChart } from "@/components/metrics/line-chart";
import { MetricsTabs } from "@/components/metrics/metrics-tabs";
import {
  isPostSort,
  POST_SORTS,
  PostsTable,
  sortPosts,
  toMetricsPost,
} from "@/components/metrics/posts-table";
import { RankBars } from "@/components/metrics/rank-bars";
import { StatTile } from "@/components/metrics/stat-tile";
import { getBrandContext } from "@/lib/active-brand";
import { db } from "@/lib/db";
import { HOOK_LABELS } from "@/lib/hooks";
import { formatDateTime } from "@/lib/time";
import { refreshMetricsAction } from "./actions";

export const metadata: Metadata = { title: "Métricas · RAdev Social" };

const RANGE_LABELS: Record<MetricsRange, string> = {
  "7": "7 días",
  "30": "30 días",
  "90": "90 días",
  all: "Todo",
};

const shortDay = (day: string) => {
  const [, month, date] = day.split("-");
  return `${Number(date)}/${Number(month)}`;
};

// What the brand's TikTok did (phase 6, ADR 0018): figures of the range, every post's views, how
// the account grows, what works (pillar, hook, day, hour, model) and every post in a table. The
// numbers come from metrics.sync; the page never calls TikTok (rule 5).
export default async function MetricsPage({ searchParams }: PageProps<"/metrics">) {
  const { activeBrand: brand } = await getBrandContext();
  const params = await searchParams;
  const range: MetricsRange = isMetricsRange(params.range) ? params.range : "30";
  const sort = isPostSort(params.sort) ? params.sort : "recent";

  if (!brand) {
    return (
      <section>
        <Plate as="h1">Métricas</Plate>
        <p className="mt-6 text-sm text-ink-dim">No hay marcas activas.</p>
      </section>
    );
  }

  const account = await getSocialAccount(db, brand.id, "tiktok");
  const now = new Date();
  const today = localDateOf(now, brand.timezone);
  const days = METRICS_RANGES[range];
  // The range starts at local midnight of its first day, in the brand's zone (rule 11).
  const fromDay = days === null ? null : addDays(today, -(days - 1));
  const from =
    fromDay === null
      ? null
      : zonedToUtc(
          {
            year: Number(fromDay.slice(0, 4)),
            month: Number(fromDay.slice(5, 7)),
            day: Number(fromDay.slice(8, 10)),
            hour: 0,
            minute: 0,
          },
          brand.timezone,
        );

  const [rows, accountDays, lastAt] = account
    ? await Promise.all([
        listMetricsPosts(db, { brandId: brand.id, network: "tiktok", from }),
        listAccountDays(db, { brandId: brand.id, network: "tiktok", fromDay }),
        getLastMetricsAt(db, { brandId: brand.id, network: "tiktok" }),
      ])
    : [[], [], null];
  const [leadTotals, outcomes] = await Promise.all([
    getLeadTotals(db, { brandId: brand.id, from }),
    countPostOutcomes(
      db,
      rows.map((row) => row.id),
    ),
  ]);
  const outcomeOf = (id: string) => outcomes.get(id) ?? { leads: 0, clients: 0 };

  const posts = rows.map(toMetricsPost);
  const summary = summarize(posts);
  const growth = accountGrowth(accountDays);
  const ours = posts.filter((post) => post.code !== null);
  const oursSummary = summarize(ours);
  const restSummary = summarize(posts.filter((post) => post.code === null));

  const link = (next: { range?: MetricsRange; sort?: string }) => {
    const query = new URLSearchParams({ range: next.range ?? range, sort: next.sort ?? sort });
    return `/metrics?${query.toString()}`;
  };

  const columns: ColumnItem[] = [...rows].reverse().map((row) => ({
    key: row.id,
    value: row.views,
    tone: row.code ? "ours" : "rest",
    axisLabel: shortDay(localDateOf(row.publishedAt, brand.timezone)),
    href: row.url ?? undefined,
    tooltip: {
      title: `${row.code ?? "Fuera del sistema"} · ${formatDateTime(row.publishedAt, brand.timezone)}`,
      subtitle: row.caption,
      rows: [
        { label: "Vistas", value: formatNumber(row.views) },
        { label: "Likes", value: formatNumber(row.likes) },
        { label: "Comentarios", value: formatNumber(row.comments) },
        { label: "Compartidos", value: formatNumber(row.shares) },
        ...(outcomeOf(row.id).leads > 0
          ? [{ label: "Leads", value: formatNumber(outcomeOf(row.id).leads) }]
          : []),
      ],
    },
  }));
  const hasBothTones = ours.length > 0 && ours.length < posts.length;

  const weekday = byWeekday(posts, brand.timezone);
  const weekdayColumns: ColumnItem[] = WEEK_ORDER.map((day) => {
    const bucket = weekday[day];
    return {
      key: String(day),
      value: bucket?.medianViews ?? 0,
      tone: "single",
      axisLabel: WEEKDAY_SHORT[day],
      tooltip: {
        title: WEEKDAY_SHORT[day],
        rows: [
          { label: "Mediana de vistas", value: formatNumber(bucket?.medianViews ?? 0) },
          { label: "Posts", value: String(bucket?.posts ?? 0) },
        ],
      },
    };
  });
  const hourColumns: ColumnItem[] = byHour(posts, brand.timezone).map((bucket) => ({
    key: String(bucket.bucket),
    value: bucket.medianViews ?? 0,
    tone: "single",
    axisLabel: `${bucket.bucket}h`,
    tooltip: {
      title: `${bucket.bucket}:00 a ${bucket.bucket}:59`,
      rows: [
        { label: "Mediana de vistas", value: formatNumber(bucket.medianViews ?? 0) },
        { label: "Posts", value: String(bucket.posts) },
      ],
    },
  }));

  const rank = (
    keyOf: (post: (typeof ours)[number]) => string | null,
    labelOf: (key: string) => string,
  ) => {
    // Leads of each group: what the typed leads say of its posts.
    const leadsBy = new Map<string, number>();
    for (const post of ours) {
      const key = keyOf(post);
      if (key !== null) leadsBy.set(key, (leadsBy.get(key) ?? 0) + outcomeOf(post.id).leads);
    }
    return groupPosts(ours, keyOf).map((group) => ({
      key: group.key,
      label: labelOf(group.key),
      medianViews: group.medianViews,
      posts: group.posts,
      engagement: group.engagement,
      leads: leadsBy.get(group.key) ?? 0,
    }));
  };
  const byPillar = rank(
    (post) => post.pillar,
    (key) => key,
  );
  const byHook = rank(
    (post) => post.hookType,
    (key) => HOOK_LABELS[key as HookType] ?? key,
  );
  const byModel = rank(
    (post) => post.model,
    (key) => key,
  );

  const followerPoints = accountDays.map((day) => ({
    key: day.day,
    label: shortDay(day.day),
    value: day.stats.followers,
  }));
  const rangeText = range === "all" ? "desde el primer post" : `en ${RANGE_LABELS[range]}`;

  return (
    <>
      <MetricsTabs current="summary" />
      <section aria-labelledby="metrics-heading" className="flex flex-col gap-6">
        <Plate
          as="h1"
          id="metrics-heading"
          aside={
            account
              ? `TikTok · ${lastAt ? `leído ${formatDateTime(lastAt, brand.timezone)}` : "sin leer todavía"}`
              : undefined
          }
        >
          Métricas
        </Plate>

        {!account ? (
          <div className="rounded-md border border-dashed border-bezel px-5 py-10">
            <p className="text-base text-ink">{brand.name} no tiene TikTok conectado.</p>
            <p className="mt-1 text-sm text-ink-dim">
              Conectalo en{" "}
              <Link href={`/brands/${brand.slug}/channels`} className="text-ink underline">
                Marcas → Canales
              </Link>{" "}
              y las métricas se leen solas cada 4 horas.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <nav aria-label="Período" className="flex flex-wrap gap-1">
                {(Object.keys(RANGE_LABELS) as MetricsRange[]).map((key) => (
                  <Link
                    key={key}
                    href={link({ range: key })}
                    className="nav-key"
                    aria-current={key === range ? "page" : undefined}
                  >
                    {RANGE_LABELS[key]}
                  </Link>
                ))}
              </nav>
              <form action={refreshMetricsAction}>
                <button type="submit" className="console-button">
                  Actualizar ahora
                </button>
              </form>
            </div>

            {lastAt === null ? (
              <div className="rounded-md border border-dashed border-bezel px-5 py-10">
                <p className="text-base text-ink">Todavía no se leyeron las métricas.</p>
                <p className="mt-1 text-sm text-ink-dim">
                  Tocá “Actualizar ahora”: en un minuto aparecen todos los posts de la cuenta.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile
                  hero
                  label="Vistas"
                  value={formatCompact(summary.views)}
                  hint={`de ${summary.posts} ${summary.posts === 1 ? "post publicado" : "posts publicados"} ${rangeText}`}
                />
                <StatTile
                  label="Seguidores"
                  value={growth.current ? formatCompact(growth.current.followers) : "—"}
                  delta={
                    growth.followersDelta === null
                      ? null
                      : {
                          text: formatDelta(growth.followersDelta),
                          direction:
                            growth.followersDelta > 0
                              ? "up"
                              : growth.followersDelta < 0
                                ? "down"
                                : "flat",
                          against: `desde el ${shortDay(accountDays[0]?.day ?? today)}`,
                        }
                  }
                  hint={
                    growth.followersDelta === null
                      ? "el cambio se ve desde el segundo día"
                      : undefined
                  }
                />
                <StatTile
                  label="Vistas por post"
                  value={summary.medianViews === null ? "—" : formatCompact(summary.medianViews)}
                  hint="mediana: el post típico, sin que uno viral lo tape"
                />
                <StatTile
                  label="Interacción"
                  value={formatPercent(summary.engagement)}
                  hint="likes, comentarios y compartidos por vista"
                />
                <StatTile
                  label="Likes"
                  value={formatCompact(summary.likes)}
                  hint={`${formatCompact(summary.shares)} compartidos · ${formatCompact(summary.comments)} comentarios`}
                />
              </div>
            )}
          </>
        )}
        <div className="flex flex-col gap-3">
          <h2 className="plate-text text-ink-dim">
            Leads y clientes ·{" "}
            <Link href="/metrics/leads" className="underline hover:text-ink">
              anotar
            </Link>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <StatTile
              label="Leads"
              value={formatCompact(leadTotals.leads)}
              hint={
                leadTotals.leads > 0
                  ? `${leadTotals.linked} con el post identificado`
                  : "anotalos en Métricas → Leads"
              }
            />
            <StatTile
              label="Clientes"
              value={formatCompact(leadTotals.clients)}
              hint={
                leadTotals.leads > 0
                  ? `${formatPercent(leadTotals.clients / leadTotals.leads)} de los leads`
                  : "leads que marcaste como cliente"
              }
            />
          </div>
        </div>
      </section>

      {account && lastAt !== null && (
        <>
          <section aria-labelledby="views-heading" className="flex flex-col gap-5">
            <Plate id="views-heading" aside={`${posts.length} posts`}>
              Vistas por post
            </Plate>
            {posts.length === 0 ? (
              <p className="text-sm text-ink-faint">No hay posts publicados {rangeText}.</p>
            ) : (
              <>
                {hasBothTones && (
                  <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-dim">
                    <li className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-2.5 rounded-[2px]"
                        style={{ background: "var(--chart-ours)" }}
                      />
                      Del sistema · mediana {formatCompact(oursSummary.medianViews ?? 0)}
                    </li>
                    <li className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-2.5 rounded-[2px]"
                        style={{ background: "var(--chart-rest)" }}
                      />
                      Resto de la cuenta · mediana {formatCompact(restSummary.medianViews ?? 0)}
                    </li>
                  </ul>
                )}
                <ColumnChart
                  label={`Vistas de cada post ${rangeText}, del más viejo al más nuevo`}
                  items={columns}
                  reference={
                    summary.medianViews === null
                      ? undefined
                      : {
                          value: summary.medianViews,
                          label: `mediana ${formatCompact(summary.medianViews)}`,
                        }
                  }
                />
              </>
            )}
          </section>

          <div className="grid grid-cols-1 gap-x-10 gap-y-14 lg:grid-cols-2">
            <section aria-labelledby="followers-heading" className="flex flex-col gap-5">
              <Plate id="followers-heading">Seguidores</Plate>
              {followerPoints.length >= 2 ? (
                <LineChart
                  points={followerPoints}
                  label={`Seguidores por día ${rangeText}`}
                  unit="seguidores"
                />
              ) : (
                <div className="flex flex-col gap-1 rounded-md border border-dashed border-bezel px-5 py-8">
                  <p className="text-3xl font-semibold text-ink">
                    {growth.current ? formatNumber(growth.current.followers) : "—"}
                  </p>
                  <p className="text-sm text-ink-dim">
                    La curva se arma sola: se guarda un punto por día desde que se conectó la
                    cuenta.
                  </p>
                </div>
              )}
            </section>

            <section aria-labelledby="when-heading" className="flex flex-col gap-5">
              <Plate id="when-heading">Cuándo publicar</Plate>
              <p className="text-xs text-ink-dim">Mediana de vistas según el día en que salió</p>
              <ColumnChart
                label="Mediana de vistas según el día de la semana en que salió el post"
                items={weekdayColumns}
                height={150}
              />
              <p className="text-xs text-ink-dim">Y según la hora</p>
              <ColumnChart
                label="Mediana de vistas según la hora en que salió el post"
                items={hourColumns}
                height={150}
              />
            </section>
          </div>

          <section aria-labelledby="works-heading" className="flex flex-col gap-5">
            <Plate id="works-heading" aside={`${ours.length} posts del sistema`}>
              Qué funciona
            </Plate>
            <p className="max-w-[70ch] text-sm text-ink-dim">
              Mediana de vistas de los posts hechos con el sistema, por pilar, tipo de gancho y
              modelo de IA. Un grupo de un solo post aparece más tenue: todavía dice poco.
            </p>
            <div className="grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-3">
              <div className="flex flex-col gap-4">
                <h3 className="plate-text text-ink-dim">Pilar</h3>
                <RankBars rows={byPillar} empty="Sin posts del sistema en el período." />
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="plate-text text-ink-dim">Gancho</h3>
                <RankBars rows={byHook} empty="Sin posts del sistema en el período." />
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="plate-text text-ink-dim">Modelo de IA</h3>
                <RankBars rows={byModel} empty="Sin posts escritos con IA en el período." />
              </div>
            </div>
          </section>

          <section aria-labelledby="posts-heading" className="flex flex-col gap-5">
            <Plate id="posts-heading">Posts</Plate>
            <nav aria-label="Orden" className="flex flex-wrap gap-1">
              {(Object.keys(POST_SORTS) as (keyof typeof POST_SORTS)[]).map((key) => (
                <Link
                  key={key}
                  href={link({ sort: key })}
                  className="nav-key"
                  aria-current={key === sort ? "page" : undefined}
                >
                  {POST_SORTS[key]}
                </Link>
              ))}
            </nav>
            {rows.length === 0 ? (
              <p className="text-sm text-ink-faint">No hay posts publicados {rangeText}.</p>
            ) : (
              <PostsTable
                rows={sortPosts(rows, sort)}
                timeZone={brand.timezone}
                medianViews={summary.medianViews}
                outcomes={outcomes}
              />
            )}
          </section>
        </>
      )}
    </>
  );
}
