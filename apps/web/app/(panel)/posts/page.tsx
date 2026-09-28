import { POST_STATUSES, type PostStatus } from "@radev/core";
import { countPostsByStatus, listPosts } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import { getBrandContext } from "@/lib/active-brand";
import { db } from "@/lib/db";
import { STATUS_DISPLAY } from "@/lib/post-status";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Posts · RAdev Social" };

const LISTED_STATUSES = POST_STATUSES.filter((s) => s !== "archived");

function isStatus(value: unknown): value is PostStatus {
  return typeof value === "string" && (POST_STATUSES as readonly string[]).includes(value);
}

// Posts of the brand the panel is tuned to (brand switcher), newest first, filtered by status.
// "Todos" leaves the discarded ones out: they have their own tab.
export default async function PostsPage({ searchParams }: PageProps<"/posts">) {
  const { activeBrand: brand } = await getBrandContext();
  if (!brand) {
    return (
      <section>
        <Plate as="h1">Posts</Plate>
        <p className="mt-6 text-sm text-ink-dim">No hay marcas activas.</p>
      </section>
    );
  }

  const { status } = await searchParams;
  const filter = isStatus(status) ? status : undefined;
  const [posts, counts] = await Promise.all([
    listPosts(db, brand.id, filter ? [filter] : LISTED_STATUSES),
    countPostsByStatus(db, brand.id),
  ]);
  const total = LISTED_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const tabs = POST_STATUSES.filter((s) => (counts[s] ?? 0) > 0);

  return (
    <section aria-labelledby="posts-heading" className="flex flex-col gap-6">
      <Plate
        as="h1"
        id="posts-heading"
        aside={
          <Link href="/posts/new" className="console-button">
            Nuevo post
          </Link>
        }
      >
        Posts · {brand.name}
      </Plate>

      {total > 0 && (
        <nav aria-label="Filtrar por estado" className="border-b border-bezel">
          <ul className="flex flex-wrap gap-1">
            <li>
              <Link href="/posts" className="nav-key" aria-current={filter ? undefined : "page"}>
                Todos <span className="timecode text-ink-faint">{total}</span>
              </Link>
            </li>
            {tabs.map((s) => (
              <li key={s}>
                <Link
                  href={`/posts?status=${s}`}
                  className="nav-key"
                  aria-current={filter === s ? "page" : undefined}
                >
                  {STATUS_DISPLAY[s].label}{" "}
                  <span className="timecode text-ink-faint">{counts[s]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {posts.length === 0 ? (
        <div className="rounded-md border border-dashed border-bezel px-5 py-10">
          <p className="text-base text-ink">
            {filter ? "No hay posts con ese estado." : `${brand.name} no tiene posts todavía.`}
          </p>
          <p className="mt-1 text-sm text-ink-dim">
            Armá el primero con{" "}
            <Link href="/posts/new" className="underline underline-offset-2">
              Nuevo post
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-bezel rounded-md border border-bezel">
          {posts.map((post) => {
            const display = STATUS_DISPLAY[post.status];
            const hook = typeof post.content?.hook === "string" ? post.content.hook : "";
            const slides = Array.isArray(post.content?.slides) ? post.content.slides.length : 0;
            return (
              <li key={post.id}>
                <Link
                  href={`/posts/${post.publicCode}`}
                  className="grid gap-2 px-4 py-4 transition-colors hover:bg-panel-raised sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:gap-5"
                >
                  <span className="callsign w-fit">{post.publicCode}</span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-sm text-ink">
                      {hook || post.generationRequest?.idea || "Sin hook"}
                    </span>
                    <span className="timecode text-xs text-ink-faint">
                      {[post.pillarName, `${slides} slides`, `v${post.versionNumber ?? 1}`]
                        .filter(Boolean)
                        .join(" · ")}{" "}
                      · {formatDateTime(post.updatedAt, brand.timezone)}
                    </span>
                  </span>
                  <Tally state={display.tally}>{display.label}</Tally>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
