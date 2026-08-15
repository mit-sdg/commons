import type { Collection, Db } from "mongodb";
import {
  CapabilityRequired,
  GrantAlreadyExists,
  GrantNotFound,
  RoleAlreadyExists,
  RoleNotFound,
} from "./errors.ts";

interface RoleDoc {
  _id: string;
  name: string;
  capabilities: string[];
  seq: number;
}

interface GrantDoc {
  _id: string;
  user: string;
  context: string;
  role: string;
  seq: number;
}

export class MongoRolingConcept {
  private readonly roles: Collection<RoleDoc>;
  private readonly grants: Collection<GrantDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.roles = db.collection<RoleDoc>("roling.roles");
    this.grants = db.collection<GrantDoc>("roling.grants");
    this.counters = db.collection("roling.counters");
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async defineRole({ name, capabilities }: { name: string; capabilities: string[] }) {
    const existing = await this.roles.findOne({ name });
    if (existing !== null) {
      throw new RoleAlreadyExists(name);
    }
    const role = crypto.randomUUID();
    const seq = await this.#nextSeq("roles");
    await this.roles.insertOne({ _id: role, name, capabilities: [...capabilities], seq });
    return { role };
  }

  async ensureRole({ name, capabilities }: { name: string; capabilities: string[] }) {
    const existing = await this.roles.findOne({ name });
    if (existing !== null) return { role: existing._id };
    const role = crypto.randomUUID();
    const seq = await this.#nextSeq("roles");
    await this.roles.insertOne({ _id: role, name, capabilities: [...capabilities], seq });
    return { role };
  }

  async grant({ user, context, role }: { user: string; context: string; role: string }) {
    const roleDoc = await this.roles.findOne({ _id: role });
    if (roleDoc === null) {
      throw new RoleNotFound(`No role named ${role}`);
    }
    const existing = await this.grants.findOne({ user, context, role });
    if (existing !== null) {
      throw new GrantAlreadyExists(`${user} already holds ${role}`);
    }
    const grant = crypto.randomUUID();
    const seq = await this.#nextSeq("grants");
    await this.grants.insertOne({ _id: grant, user, context, role, seq });
    return { grant };
  }

  async revoke({ user, context, role }: { user: string; context: string; role: string }) {
    const doc = await this.grants.findOne({ user, context, role });
    if (doc === null) {
      throw new GrantNotFound(`${user} holds no ${role} in ${context}`);
    }
    await this.grants.deleteOne({ _id: doc._id });
    return { grant: doc._id };
  }

  async requireCapability({
    user,
    context,
    capability,
  }: {
    user: string;
    context: string;
    capability: string;
  }) {
    const { allowed } = await this._hasCapability({ user, context, capability });
    if (!allowed) throw new CapabilityRequired(capability);
    return { allowed: true as const };
  }

  async _hasCapability({
    user,
    context,
    capability,
  }: {
    user: string;
    context: string;
    capability: string;
  }) {
    const grants = await this.grants.find({ user, context }).toArray();
    if (grants.length === 0) return { allowed: false };
    const roleIds = grants.map((doc) => doc.role);
    const roles = await this.roles.find({ _id: { $in: roleIds } }).toArray();
    const allowed = roles.some((doc) => doc.capabilities.includes(capability));
    return { allowed };
  }

  async _hasCapabilityHolder({ context, capability }: { context: string; capability: string }) {
    const grants = await this.grants.find({ context }).toArray();
    if (grants.length === 0) return { present: false };
    const roleIds = grants.map((doc) => doc.role);
    const roles = await this.roles.find({ _id: { $in: roleIds } }).toArray();
    const present = roles.some((doc) => doc.capabilities.includes(capability));
    return { present };
  }

  async _holdsRoleNamed({ user, context, name }: { user: string; context: string; name: string }) {
    const role = await this.roles.findOne({ name });
    if (role === null) return { held: false };
    return { held: (await this.grants.findOne({ user, context, role: role._id })) !== null };
  }

  async _getRoles({ user, context }: { user: string; context: string }) {
    const docs = await this.grants.find({ user, context }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ role: doc.role }));
  }

  async _getRoleByName({ name }: { name: string }) {
    const doc = await this.roles.findOne({ name });
    return doc === null ? [] : [{ role: doc._id }];
  }

  async _getRoleDetail({ role }: { role: string }) {
    const doc = await this.roles.findOne({ _id: role });
    return doc === null ? [] : [{ name: doc.name, capabilities: [...doc.capabilities] }];
  }

  async _listRoles(_: Record<string, never>) {
    const docs = await this.roles.find().sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({
      role: doc._id,
      name: doc.name,
      capabilities: [...doc.capabilities],
    }));
  }

  async _denotedRole({ ref }: { ref: string }) {
    const byId = await this.roles.findOne({ _id: ref });
    if (byId !== null) return { role: ref };
    const byName = await this.roles.findOne({ name: ref });
    if (byName !== null) return { role: byName._id };
    return { role: ref };
  }
}
