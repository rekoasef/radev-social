import type { Network } from "@radev/core";

// What every publishing adapter does (docs/ARCHITECTURE.md §9). For now only what `manual` needs;
// checkStatus and refreshToken arrive with the TikTok adapter.

export type PublishInput = {
  postId: string;
  publicCode: string;
};

export type PublishResult =
  /** Waiting for something outside the system (the operator, for `manual`). */
  | { status: "pending"; note: string }
  | { status: "published"; url: string | null; publishedAt: Date }
  | { status: "failed"; error: string };

export interface PublisherAdapter {
  network: Network;
  /** Idempotent per (post, network): asking twice must not publish twice (rule 8). */
  publish(input: PublishInput): Promise<PublishResult>;
}
