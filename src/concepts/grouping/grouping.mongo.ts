import type { Collection, Db } from "mongodb";
import {
  AlreadyAMember,
  GroupNotFound,
  LastMember,
  NotAMember,
  TargetNotAMember,
} from "./errors.ts";

interface GroupDoc {
  _id: string;
  title: string;
  members: string[];
  createdAt: Date;
  updatedAt: Date;
  seq: number;
}

export class MongoGroupingConcept {
  private readonly groups: Collection<GroupDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db, instance = "Grouping") {
    const prefix = `${instance[0]?.toLowerCase() ?? ""}${instance.slice(1)}`;
    this.groups = db.collection<GroupDoc>(`${prefix}.groups`);
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

  async #require(group: string): Promise<GroupDoc> {
    const doc = await this.groups.findOne({ _id: group });
    if (doc === null) throw new GroupNotFound(group);
    return doc;
  }

  async create({ title, creator, at }: { title: string; creator: string; at: Date }) {
    const group = crypto.randomUUID();
    const seq = await this.#nextSeq("groups");
    await this.groups.insertOne({
      _id: group,
      title,
      members: [creator],
      createdAt: at,
      updatedAt: at,
      seq,
    });
    return { group };
  }

  async rename({
    group,
    member,
    title,
    at,
  }: {
    group: string;
    member: string;
    title: string;
    at: Date;
  }) {
    const doc = await this.#require(group);
    if (!doc.members.includes(member)) throw new NotAMember(member);
    await this.groups.updateOne({ _id: group }, { $set: { title, updatedAt: at } });
    return { group };
  }

  async addMember({
    group,
    member,
    candidate,
    at,
  }: {
    group: string;
    member: string;
    candidate: string;
    at: Date;
  }) {
    const doc = await this.#require(group);
    if (!doc.members.includes(member)) throw new NotAMember(member);
    if (doc.members.includes(candidate)) throw new AlreadyAMember(candidate);
    await this.groups.updateOne(
      { _id: group },
      { $push: { members: candidate }, $set: { updatedAt: at } },
    );
    return { group };
  }

  async removeMember({
    group,
    member,
    target,
    at,
  }: {
    group: string;
    member: string;
    target: string;
    at: Date;
  }) {
    const doc = await this.#require(group);
    if (!doc.members.includes(member)) throw new NotAMember(member);
    if (!doc.members.includes(target)) throw new TargetNotAMember(target);
    if (doc.members.length <= 1) throw new LastMember(target);
    await this.groups.updateOne(
      { _id: group },
      { $pull: { members: target }, $set: { updatedAt: at } },
    );
    return { group };
  }

  async leave({ group, member, at }: { group: string; member: string; at: Date }) {
    const doc = await this.#require(group);
    if (!doc.members.includes(member)) throw new NotAMember(member);
    if (doc.members.length <= 1) throw new LastMember(member);
    await this.groups.updateOne(
      { _id: group },
      { $pull: { members: member }, $set: { updatedAt: at } },
    );
    return { group };
  }

  async _getGroup({ group }: { group: string }) {
    const doc = await this.groups.findOne({ _id: group });
    return doc === null
      ? []
      : [{ title: doc.title, createdAt: doc.createdAt, updatedAt: doc.updatedAt }];
  }

  async _getMembers({ group }: { group: string }) {
    const doc = await this.groups.findOne({ _id: group });
    return doc === null ? [] : doc.members.map((member) => ({ member }));
  }

  async _getGroupsOf({ member }: { member: string }) {
    const docs = await this.groups.find({ members: member }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      group: doc._id,
      title: doc.title,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  async _isMember({ group, member }: { group: string; member: string }) {
    const doc = await this.groups.findOne({ _id: group });
    return { isMember: doc !== null && doc.members.includes(member) };
  }
}
