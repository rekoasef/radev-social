import {
  type LeadChannel,
  type LeadStatus,
  LINKS_PAGE_POSTS,
  type LinkEventKind,
  normalizePostRef,
  postRef,
  type SocialNetwork,
} from "@radev/core";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  type BrandLink,
  brandLinks,
  type Lead,
  leads,
  linkEvents,
  networkPosts,
  posts,
} from "../schema";
import type { Executor } from "./brand-assets";

// A brand's links page and its leads (phase 6 T5, RF-40 to RF-42): the links the operator sets,
// what visitors do on the page (anonymous events) and the leads the operator types.

export function listBrandLinks(db: Executor, brandId: string): Promise<BrandLink[]> {
  return db
    .select()
    .from(brandLinks)
    .where(eq(brandLinks.brandId, brandId))
    .orderBy(asc(brandLinks.position), asc(brandLinks.createdAt));
}

export async function getBrandLink(
  db: Executor,
  input: { brandId: string; id: string },
): Promise<BrandLink | undefined> {
  const [row] = await db
    .select()
    .from(brandLinks)
    .where(and(eq(brandLinks.brandId, input.brandId), eq(brandLinks.id, input.id)));
  return row;
}

/** Adds a link at the end, or updates one of the brand's. `primary` moves from any other link. */
export async function saveBrandLink(
  db: Executor,
  input: {
    brandId: string;
    id?: string;
    title: string;
    url: string;
    primary: boolean;
    active: boolean;
  },
): Promise<void> {
  if (input.primary) {
    await db
      .update(brandLinks)
      .set({ primary: false })
      .where(and(eq(brandLinks.brandId, input.brandId), eq(brandLinks.primary, true)));
  }
  const values = {
    title: input.title,
    url: input.url,
    primary: input.primary,
    active: input.active,
  };
  if (input.id) {
    await db
      .update(brandLinks)
      .set(values)
      .where(and(eq(brandLinks.brandId, input.brandId), eq(brandLinks.id, input.id)));
    return;
  }
  const [last] = await db
    .select({ position: sql<number>`coalesce(max(${brandLinks.position}), -1)::int` })
    .from(brandLinks)
    .where(eq(brandLinks.brandId, input.brandId));
  await db
    .insert(brandLinks)
    .values({ brandId: input.brandId, position: (last?.position ?? -1) + 1, ...values });
}

export async function deleteBrandLink(
  db: Executor,
  input: { brandId: string; id: string },
): Promise<void> {
  await db
    .delete(brandLinks)
    .where(and(eq(brandLinks.brandId, input.brandId), eq(brandLinks.id, input.id)));
}

/** Moves a link one place up or down. */
export async function moveBrandLink(
  db: Executor,
  input: { brandId: string; id: string; direction: "up" | "down" },
): Promise<void> {
  const list = await listBrandLinks(db, input.brandId);
  const index = list.findIndex((link) => link.id === input.id);
  const other = list[input.direction === "up" ? index - 1 : index + 1];
  const current = list[index];
  if (!current || !other) return;
  // Positions may repeat (older rows): reassign all in the new order.
  const order = [...list];
  order[index] = other;
  order[list.indexOf(other)] = current;
  for (const [position, link] of order.entries()) {
    await db.update(brandLinks).set({ position }).where(eq(brandLinks.id, link.id));
  }
}

/** A post the links page offers: its cover and the reference its message carries. */
export type LinksPagePost = {
  id: string;
  ref: string;
  caption: string;
  coverPath: string | null;
  publishedAt: Date;
};

/** The brand's latest posts on the network, for "¿Por qué post venís?". */
export async function listLinksPagePosts(
  db: Executor,
  input: { brandId: string; network: SocialNetwork; limit?: number },
): Promise<LinksPagePost[]> {
  const rows = await db
    .select({
      id: networkPosts.id,
      externalId: networkPosts.externalId,
      code: posts.publicCode,
      caption: networkPosts.caption,
      coverPath: networkPosts.coverPath,
      publishedAt: networkPosts.publishedAt,
    })
    .from(networkPosts)
    .leftJoin(posts, eq(posts.id, networkPosts.postId))
    .where(and(eq(networkPosts.brandId, input.brandId), eq(networkPosts.network, input.network)))
    .orderBy(desc(networkPosts.publishedAt))
    .limit(input.limit ?? LINKS_PAGE_POSTS);
  return rows.map((row) => ({
    id: row.id,
    ref: postRef(row),
    caption: row.caption,
    coverPath: row.coverPath,
    publishedAt: row.publishedAt,
  }));
}

/** One of the brand's network posts, checked to belong to it (the page's links carry its id). */
export async function getBrandNetworkPost(
  db: Executor,
  input: { brandId: string; id: string },
): Promise<LinksPagePost | undefined> {
  const [row] = await db
    .select({
      id: networkPosts.id,
      externalId: networkPosts.externalId,
      code: posts.publicCode,
      caption: networkPosts.caption,
      coverPath: networkPosts.coverPath,
      publishedAt: networkPosts.publishedAt,
    })
    .from(networkPosts)
    .leftJoin(posts, eq(posts.id, networkPosts.postId))
    .where(and(eq(networkPosts.brandId, input.brandId), eq(networkPosts.id, input.id)));
  return row && { ...row, ref: postRef(row) };
}

export async function recordLinkEvent(
  db: Executor,
  input: {
    brandId: string;
    kind: LinkEventKind;
    networkPostId?: string | null;
    linkId?: string | null;
    referrer?: string | null;
  },
): Promise<void> {
  await db.insert(linkEvents).values({
    brandId: input.brandId,
    kind: input.kind,
    networkPostId: input.networkPostId ?? null,
    linkId: input.linkId ?? null,
    referrer: input.referrer ?? null,
  });
}

export type LinkTotals = { views: number; whatsapp: number; links: number };

/** What the brand's links page did since `from` (all without it). */
export async function getLinkTotals(
  db: Executor,
  input: { brandId: string; from: Date | null },
): Promise<LinkTotals> {
  const rows = await db
    .select({ kind: linkEvents.kind, count: sql<number>`count(*)::int` })
    .from(linkEvents)
    .where(
      and(
        eq(linkEvents.brandId, input.brandId),
        input.from ? gte(linkEvents.createdAt, input.from) : undefined,
      ),
    )
    .groupBy(linkEvents.kind);
  const count = (kind: LinkEventKind) => rows.find((row) => row.kind === kind)?.count ?? 0;
  return { views: count("view"), whatsapp: count("whatsapp"), links: count("link") };
}

/** Clicks (WhatsApp and links) and leads of each network post, for the metrics page. */
export async function countPostOutcomes(
  db: Executor,
  networkPostIds: readonly string[],
): Promise<Map<string, { clicks: number; leads: number; clients: number }>> {
  const result = new Map<string, { clicks: number; leads: number; clients: number }>();
  if (networkPostIds.length === 0) return result;
  const ids = [...networkPostIds];
  const [clicks, leadRows] = await Promise.all([
    db
      .select({ id: linkEvents.networkPostId, count: sql<number>`count(*)::int` })
      .from(linkEvents)
      .where(
        and(inArray(linkEvents.networkPostId, ids), inArray(linkEvents.kind, ["whatsapp", "link"])),
      )
      .groupBy(linkEvents.networkPostId),
    db
      .select({
        id: leads.networkPostId,
        count: sql<number>`count(*)::int`,
        clients: sql<number>`count(*) filter (where ${leads.status} = 'client')::int`,
      })
      .from(leads)
      .where(inArray(leads.networkPostId, ids))
      .groupBy(leads.networkPostId),
  ]);
  const entry = (id: string) => {
    const current = result.get(id) ?? { clicks: 0, leads: 0, clients: 0 };
    result.set(id, current);
    return current;
  };
  for (const row of clicks) if (row.id) entry(row.id).clicks = row.count;
  for (const row of leadRows) {
    if (!row.id) continue;
    entry(row.id).leads = row.count;
    entry(row.id).clients = row.clients;
  }
  return result;
}

/**
 * The network post a reference names, among the brand's: our code (RA-0142) or TK- and the end
 * of TikTok's id. Null when none matches (the lead keeps the reference as typed).
 */
export async function findNetworkPostByRef(
  db: Executor,
  input: { brandId: string; ref: string },
): Promise<string | null> {
  const ref = normalizePostRef(input.ref);
  if (!ref) return null;
  if (ref.startsWith("TK-")) {
    const tail = ref.slice(3);
    if (!/^\d{4,}$/.test(tail)) return null;
    const rows = await db
      .select({ id: networkPosts.id })
      .from(networkPosts)
      .where(
        and(
          eq(networkPosts.brandId, input.brandId),
          sql`${networkPosts.externalId} like ${`%${tail}`}`,
        ),
      )
      .limit(2);
    // Ambiguous ends are left unlinked rather than guessed.
    return rows.length === 1 ? (rows[0]?.id ?? null) : null;
  }
  const [row] = await db
    .select({ id: networkPosts.id })
    .from(networkPosts)
    .innerJoin(posts, eq(posts.id, networkPosts.postId))
    .where(and(eq(networkPosts.brandId, input.brandId), eq(posts.publicCode, ref)));
  return row?.id ?? null;
}

export type LeadRow = Lead & { postCaption: string | null };

export async function listLeads(
  db: Executor,
  input: { brandId: string; status?: LeadStatus; search?: string },
): Promise<LeadRow[]> {
  const search = input.search?.trim();
  return db
    .select({
      id: leads.id,
      brandId: leads.brandId,
      name: leads.name,
      contact: leads.contact,
      channel: leads.channel,
      postRef: leads.postRef,
      networkPostId: leads.networkPostId,
      status: leads.status,
      notes: leads.notes,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      postCaption: networkPosts.caption,
    })
    .from(leads)
    .leftJoin(networkPosts, eq(networkPosts.id, leads.networkPostId))
    .where(
      and(
        eq(leads.brandId, input.brandId),
        input.status ? eq(leads.status, input.status) : undefined,
        search
          ? sql`(${leads.name} ilike ${`%${search}%`} or ${leads.contact} ilike ${`%${search}%`} or ${leads.postRef} ilike ${`%${search}%`} or ${leads.notes} ilike ${`%${search}%`})`
          : undefined,
      ),
    )
    .orderBy(desc(leads.createdAt));
}

/** Adds or updates a lead; its post reference is resolved to the brand's network post. */
export async function saveLead(
  db: Executor,
  input: {
    brandId: string;
    id?: string;
    name: string;
    contact: string;
    channel: LeadChannel;
    postRef: string | null;
    status: LeadStatus;
    notes: string;
  },
): Promise<{ linked: boolean }> {
  const ref = input.postRef ? normalizePostRef(input.postRef) : null;
  const networkPostId = ref
    ? await findNetworkPostByRef(db, { brandId: input.brandId, ref })
    : null;
  const values = {
    name: input.name,
    contact: input.contact,
    channel: input.channel,
    postRef: ref,
    networkPostId,
    status: input.status,
    notes: input.notes,
  };
  if (input.id) {
    await db
      .update(leads)
      .set(values)
      .where(and(eq(leads.brandId, input.brandId), eq(leads.id, input.id)));
    return { linked: networkPostId !== null };
  }
  await db.insert(leads).values({ brandId: input.brandId, ...values });
  return { linked: networkPostId !== null };
}

export async function setLeadStatus(
  db: Executor,
  input: { brandId: string; id: string; status: LeadStatus },
): Promise<void> {
  await db
    .update(leads)
    .set({ status: input.status })
    .where(and(eq(leads.brandId, input.brandId), eq(leads.id, input.id)));
}

export async function deleteLead(db: Executor, input: { brandId: string; id: string }) {
  await db.delete(leads).where(and(eq(leads.brandId, input.brandId), eq(leads.id, input.id)));
}

/** Leads and clients of the brand since `from` (all without it). */
export async function getLeadTotals(
  db: Executor,
  input: { brandId: string; from: Date | null },
): Promise<{ leads: number; clients: number; linked: number }> {
  const [row] = await db
    .select({
      leads: sql<number>`count(*)::int`,
      clients: sql<number>`count(*) filter (where ${leads.status} = 'client')::int`,
      linked: sql<number>`count(${leads.networkPostId})::int`,
    })
    .from(leads)
    .where(
      and(
        eq(leads.brandId, input.brandId),
        input.from ? gte(leads.createdAt, input.from) : undefined,
      ),
    );
  return row ?? { leads: 0, clients: 0, linked: 0 };
}
