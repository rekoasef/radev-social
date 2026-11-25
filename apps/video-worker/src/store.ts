import type { VideoFailure, WorkingStage } from "@radev/core";
import {
  completeVideoOffice,
  type Database,
  getVideo,
  pauseVideoById,
  recordUsageEvent,
  recordVideoFailure,
  resumeVideoById,
} from "@radev/db";
import type { RunnerStore } from "./runner";

/** The runner's store, on the database. Every write goes through packages/db (rule 2). */
export function dbStore(db: Database): RunnerStore {
  return {
    getVideo: (id) => getVideo(db, id),
    resume: async (id) => {
      await resumeVideoById(db, id);
    },
    pauseForLimit: async (id, resumeAt) => {
      await pauseVideoById(db, id, "provider_limit", resumeAt);
    },
    pauseForBudget: async (id) => {
      await pauseVideoById(db, id, "budget");
    },
    complete: async (videoId, result) => {
      const outcome = await completeVideoOffice(db, videoId, result.documents, {
        title: result.title,
      });
      if (outcome.ok) {
        for (const u of result.usage ?? []) {
          await recordUsageEvent(db, {
            videoId,
            kind: u.kind,
            office: outcome.from as WorkingStage,
            quantity: u.quantity,
            unit: u.unit,
            durationMs: u.durationMs ?? null,
          });
        }
      }
      return outcome;
    },
    fail: async (id, failure: VideoFailure) => {
      await recordVideoFailure(db, id, failure);
    },
  };
}
