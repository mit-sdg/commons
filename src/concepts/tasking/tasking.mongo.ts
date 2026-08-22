import type { Collection, Db } from "mongodb";
import {
  TaskAlreadyCanceled,
  TaskAlreadyComplete,
  TaskCanceled,
  TaskNotComplete,
  TaskNotFound,
  TaskWindowInvalid,
} from "./errors.ts";

type TaskState = "OPEN" | "DONE" | "CANCELED";

interface TaskDoc {
  _id: string;
  scope: string;
  title: string;
  details: string;
  startsAt: string;
  endsAt: string;
  assignee: string | null;
  state: TaskState;
  createdAt: Date;
  updatedAt: Date;
  seq: number;
}

const moment = (value: string): number => Date.parse(value);

const wellFormedWindow = (startsAt: string, endsAt: string): boolean => {
  const start = moment(startsAt);
  const end = moment(endsAt);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start;
};

const row = (doc: TaskDoc, at: Date) => ({
  scope: doc.scope,
  title: doc.title,
  details: doc.details,
  startsAt: doc.startsAt,
  endsAt: doc.endsAt,
  assignee: doc.assignee,
  state: doc.state,
  overdue: doc.state === "OPEN" && moment(doc.endsAt) < at.getTime(),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export class MongoTaskingConcept {
  private readonly tasks: Collection<TaskDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db, instance = "Tasking") {
    const prefix = `${instance[0]?.toLowerCase() ?? ""}${instance.slice(1)}`;
    this.tasks = db.collection<TaskDoc>(`${prefix}.tasks`);
    this.counters = db.collection(`${prefix}.counters`);
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async #require(task: string): Promise<TaskDoc> {
    const doc = await this.tasks.findOne({ _id: task });
    if (doc === null) throw new TaskNotFound(task);
    return doc;
  }

  async create({
    scope,
    title,
    details,
    startsAt,
    endsAt,
    assignee,
    at,
  }: {
    scope: string;
    title: string;
    details: string;
    startsAt: string;
    endsAt: string;
    assignee: string | null;
    at: Date;
  }) {
    if (!wellFormedWindow(startsAt, endsAt)) {
      throw new TaskWindowInvalid("A task's window cannot end before it begins.");
    }
    const task = crypto.randomUUID();
    const seq = await this.#nextSeq("tasks");
    await this.tasks.insertOne({
      _id: task,
      scope,
      title,
      details,
      startsAt,
      endsAt,
      assignee: assignee ?? null,
      state: "OPEN",
      createdAt: at,
      updatedAt: at,
      seq,
    });
    return { task };
  }

  async describe({
    task,
    title,
    details,
    at,
  }: {
    task: string;
    title: string;
    details: string;
    at: Date;
  }) {
    const doc = await this.#require(task);
    if (doc.state === "CANCELED") throw new TaskCanceled(task);
    await this.tasks.updateOne({ _id: task }, { $set: { title, details, updatedAt: at } });
    return { task };
  }

  async retime({
    task,
    startsAt,
    endsAt,
    at,
  }: {
    task: string;
    startsAt: string;
    endsAt: string;
    at: Date;
  }) {
    const doc = await this.#require(task);
    if (doc.state === "CANCELED") throw new TaskCanceled(task);
    if (!wellFormedWindow(startsAt, endsAt)) {
      throw new TaskWindowInvalid("A task's window cannot end before it begins.");
    }
    await this.tasks.updateOne({ _id: task }, { $set: { startsAt, endsAt, updatedAt: at } });
    return { task };
  }

  async assign({ task, assignee, at }: { task: string; assignee: string; at: Date }) {
    const doc = await this.#require(task);
    if (doc.state === "CANCELED") throw new TaskCanceled(task);
    await this.tasks.updateOne({ _id: task }, { $set: { assignee, updatedAt: at } });
    return { task };
  }

  async release({ task, at }: { task: string; at: Date }) {
    const doc = await this.#require(task);
    if (doc.state === "CANCELED") throw new TaskCanceled(task);
    await this.tasks.updateOne({ _id: task }, { $set: { assignee: null, updatedAt: at } });
    return { task };
  }

  async complete({ task, at }: { task: string; at: Date }) {
    const doc = await this.#require(task);
    if (doc.state === "DONE") throw new TaskAlreadyComplete(task);
    if (doc.state === "CANCELED") throw new TaskCanceled(task);
    await this.tasks.updateOne({ _id: task }, { $set: { state: "DONE", updatedAt: at } });
    return { task };
  }

  async reopen({ task, at }: { task: string; at: Date }) {
    const doc = await this.#require(task);
    if (doc.state === "OPEN") throw new TaskNotComplete(task);
    if (doc.state === "CANCELED") throw new TaskCanceled(task);
    await this.tasks.updateOne({ _id: task }, { $set: { state: "OPEN", updatedAt: at } });
    return { task };
  }

  async cancel({ task, at }: { task: string; at: Date }) {
    const doc = await this.#require(task);
    if (doc.state === "DONE") throw new TaskAlreadyComplete(task);
    if (doc.state === "CANCELED") throw new TaskAlreadyCanceled(task);
    await this.tasks.updateOne({ _id: task }, { $set: { state: "CANCELED", updatedAt: at } });
    return { task };
  }

  async _getTask({ task, at }: { task: string; at: Date }) {
    const doc = await this.tasks.findOne({ _id: task });
    return doc === null ? [] : [row(doc, at)];
  }

  async _getTasksInScope({ scope, at }: { scope: string; at: Date }) {
    const docs = await this.tasks.find({ scope }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => {
      const { scope: _scope, ...fields } = row(doc, at);
      return { task: doc._id, ...fields };
    });
  }

  async _getAssigned({ assignee, at }: { assignee: string; at: Date }) {
    const docs = await this.tasks.find({ assignee }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => {
      const { assignee: _recorded, ...fields } = row(doc, at);
      return { task: doc._id, ...fields };
    });
  }
}
