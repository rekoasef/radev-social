"use server";

import { revalidatePath } from "next/cache";
import { queueMetricsSync } from "@/lib/jobs";
import { requireOperator } from "@/lib/session";

/** "Actualizar ahora": the worker reads every connected account (rule 5: the web only queues). */
export async function refreshMetricsAction(): Promise<void> {
  await requireOperator();
  await queueMetricsSync();
  revalidatePath("/metrics");
}
