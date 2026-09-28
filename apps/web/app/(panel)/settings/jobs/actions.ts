"use server";

import { canRetryJob, isJobName, jobTarget } from "@radev/core";
import { getJob, loadJobTargets } from "@radev/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { retryContext, targetIds } from "@/lib/job-targets";
import { retryJob } from "@/lib/jobs";
import { requireOperator } from "@/lib/session";

const input = z.object({ id: z.uuid() });

/**
 * "Reintentar" in the jobs view: only a failed job whose retry would do something, checked again
 * here with fresh data (canRetryJob). The worker runs it; the web only queues (rule 5).
 */
export async function retryJobAction(form: FormData): Promise<void> {
  await requireOperator();
  const { id } = input.parse(Object.fromEntries(form));
  const job = await getJob(db, id);
  if (!job || !isJobName(job.name)) redirect("/settings/jobs?tab=failed&error=missing");

  const target = jobTarget(job.name, job.data);
  const targets = await loadJobTargets(db, targetIds([target]));
  const check = canRetryJob(job.name, job.state, retryContext(target, targets));
  if (!check.ok) redirect("/settings/jobs?tab=failed&error=cannot");

  await retryJob(job.name, job.id);
  const after = await getJob(db, id);
  revalidatePath("/settings/jobs");
  revalidatePath("/settings");
  redirect(
    after && after.state !== "failed"
      ? `/settings/jobs?tab=pending&listo=${id}`
      : "/settings/jobs?tab=failed&error=retry",
  );
}
