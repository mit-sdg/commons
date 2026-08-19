import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Tasking.md" with { type: "text" };
import { MongoTaskingConcept } from "./tasking.mongo.ts";
import {
  TaskAlreadyCanceled,
  TaskAlreadyComplete,
  TaskCanceled,
  TaskNotComplete,
  TaskNotFound,
  TaskWindowInvalid,
} from "./errors.ts";

export const tasking = registerConcept({
  class: MongoTaskingConcept,
  spec,
  refusals: {
    TASK_ALREADY_CANCELED: TaskAlreadyCanceled,
    TASK_ALREADY_COMPLETE: TaskAlreadyComplete,
    TASK_CANCELED: TaskCanceled,
    TASK_NOT_COMPLETE: TaskNotComplete,
    TASK_NOT_FOUND: TaskNotFound,
    TASK_WINDOW_INVALID: TaskWindowInvalid,
  },
  floors: {
    mongo: ({ database }: { database: Db }, instance: string) =>
      new MongoTaskingConcept(database, instance),
  },
});
