import type { VideoFailure } from "@radev/core";
import {
  completeVideoOffice,
  type Database,
  getVideo,
  pauseVideoById,
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
    complete: (videoId, result) =>
      completeVideoOffice(db, videoId, result.documents, { title: result.title }),
    fail: async (id, failure: VideoFailure) => {
      await recordVideoFailure(db, id, failure);
    },
  };
}
