import {
  AI_TASK_LABELS,
  type AiTask,
  DATA_SOURCE_LABELS,
  type DataSource,
  type JobTarget,
  NOTIFICATION_KIND_LABELS,
  type NotificationKind,
  type RetryContext,
} from "@radev/core";
import type { JobTargets } from "@radev/db";

/** The ids to look up for a set of job targets (loadJobTargets). */
export function targetIds(targets: readonly JobTarget[]) {
  const ids = {
    postIds: new Set<string>(),
    versionIds: new Set<string>(),
    requestIds: new Set<string>(),
    notificationIds: new Set<string>(),
  };
  for (const target of targets) {
    if (target.kind === "post") ids.postIds.add(target.postId);
    if (target.kind === "version") ids.versionIds.add(target.versionId);
    if (target.kind === "ideaRequest") ids.requestIds.add(target.requestId);
    if (target.kind === "notification") ids.notificationIds.add(target.notificationId);
  }
  return {
    postIds: [...ids.postIds],
    versionIds: [...ids.versionIds],
    requestIds: [...ids.requestIds],
    notificationIds: [...ids.notificationIds],
  };
}

/** The post a job works on (directly or through a version), if it still exists. */
export function targetPost(target: JobTarget, targets: JobTargets) {
  if (target.kind === "post") return targets.posts.get(target.postId);
  if (target.kind === "version") return targets.versions.get(target.versionId);
  return undefined;
}

/** What canRetryJob needs to know about a job's target. */
export function retryContext(target: JobTarget, targets: JobTargets): RetryContext {
  return {
    post:
      target.kind === "post" || target.kind === "version"
        ? (targetPost(target, targets) ?? null)
        : undefined,
    versionId: target.kind === "version" ? target.versionId : undefined,
    ideaRequest:
      target.kind === "ideaRequest"
        ? (targets.ideaRequests.get(target.requestId) ?? null)
        : undefined,
  };
}

/** What a job works on, in words, and where to see it. */
export function describeTarget(
  target: JobTarget,
  targets: JobTargets,
): { text: string; href?: string } {
  switch (target.kind) {
    case "post":
    case "version": {
      const post = targetPost(target, targets);
      return post
        ? { text: `${post.publicCode} · ${post.brandName}`, href: `/posts/${post.publicCode}` }
        : { text: "Post borrado" };
    }
    case "ideaRequest": {
      const request = targets.ideaRequests.get(target.requestId);
      return request
        ? {
            text: `${request.brandName} · ${AI_TASK_LABELS[request.task as AiTask] ?? request.task}`,
            href: "/ideas",
          }
        : { text: "Pedido borrado" };
    }
    case "notification": {
      const notice = targets.notifications.get(target.notificationId);
      return notice
        ? {
            text: `${NOTIFICATION_KIND_LABELS[notice.kind as NotificationKind] ?? notice.kind}${notice.sent ? " · enviado" : ""}`,
            href: "/settings#telegram-heading",
          }
        : { text: "Aviso borrado" };
    }
    case "source":
      return {
        text: DATA_SOURCE_LABELS[target.source as DataSource] ?? target.source,
        href: "/settings#data-heading",
      };
    default:
      return { text: "Todas las marcas" };
  }
}
