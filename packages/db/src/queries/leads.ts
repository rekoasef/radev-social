import {
  type LeadChannel,
  type LeadStatus,
  normalizePostRef,
  postRef,
  type SocialNetwork,
} from "@radev/core";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { type Lead, leads, networkPosts, posts } from "../schema";
import type { Executor } from "./brand-assets";

// A brand's leads (phase 6 T5, RF-42), typed by the operator with the post that brought them.

/** One of the brand's network posts, with the reference a lead names it by. */
export type NetworkPostRef = {
  id: string;
  ref: string;
  caption: string;
  coverPath: string | null;
  publishedAt: Date;
};

/** The brand's latest posts on the network, to pick the one a lead came from. */
export async function listRecentNetworkPosts(
  db: Executor,
  input: { brandId: string; network: SocialNetwork; limit: number },
): Promise<NetworkPostRef[]> {
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
    .limit(input.limit);
  return rows.map((row) => ({
    id: row.id,
    ref: postRef(row),
    caption: row.caption,
    coverPath: row.coverPath,
    publishedAt: row.publishedAt,
  }));
}

/** Leads and clients of each network post, for the metrics page. */
export async function countPostOutcomes(
  db: Executor,
  networkPostIds: readonly string[],
): Promise<Map<string, { leads: number; clients: number }>> {
  const result = new Map<string, { leads: number; clients: number }>();
  if (networkPostIds.length === 0) return result;
  const rows = await db
    .select({
      id: leads.networkPostId,
      count: sql<number>`count(*)::int`,
      clients: sql<number>`count(*) filter (where ${leads.status} = 'client')::int`,
    })
    .from(leads)
    .where(inArray(leads.networkPostId, [...networkPostIds]))
    .groupBy(leads.networkPostId);
  for (const row of rows) {
    if (row.id) result.set(row.id, { leads: row.count, clients: row.clients });
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
