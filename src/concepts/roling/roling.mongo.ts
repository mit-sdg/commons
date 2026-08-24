import type { Collection, Db } from "mongodb";
import {
  AssignmentNotFound,
  CapabilityRequired,
  RoleAlreadyExists,
  RoleInUse,
  RoleNotFound,
} from "./errors.ts";

interface RoleDoc {
  _id: string;
  name: string;
  capabilities: string[];
  seq: number;
}

interface AssignmentDoc {
  _id: string;
  user: string;
  context: string;
  role: string;
  seq: number;
}

export class MongoRolingConcept {
  private readonly roles: Collection<RoleDoc>;
  private readonly assignments: Collection<AssignmentDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db, instance = "Roling") {
    const prefix = `${instance[0]?.toLowerCase() ?? ""}${instance.slice(1)}`;
    this.roles = db.collection<RoleDoc>(`${prefix}.roles`);
    this.assignments = db.collection<AssignmentDoc>(`${prefix}.assignments`);
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

  /** Which capabilities does this user reach in this context? */
  async #capabilitiesOf(user: string, context: string): Promise<string[]> {
    const assignment = await this.assignments.findOne({ user, context });
    if (assignment === null) return [];
    const role = await this.roles.findOne({ _id: assignment.role });
    return role === null ? [] : role.capabilities;
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

  async deleteRole({ role }: { role: string }) {
    const doc = await this.roles.findOne({ _id: role });
    if (doc === null) {
      throw new RoleNotFound(`No role named ${role}`);
    }
    const held = await this.assignments.findOne({ role });
    if (held !== null) {
      throw new RoleInUse(`${doc.name} is still assigned`);
    }
    await this.roles.deleteOne({ _id: role });
    return { role };
  }

  async assign({ user, context, role }: { user: string; context: string; role: string }) {
    const roleDoc = await this.roles.findOne({ _id: role });
    if (roleDoc === null) {
      throw new RoleNotFound(`No role named ${role}`);
    }
    const existing = await this.assignments.findOne({ user, context });
    if (existing !== null) {
      await this.assignments.updateOne({ _id: existing._id }, { $set: { role } });
      return { assignment: existing._id };
    }
    const assignment = crypto.randomUUID();
    const seq = await this.#nextSeq("assignments");
    await this.assignments.insertOne({ _id: assignment, user, context, role, seq });
    return { assignment };
  }

  async revoke({ user, context }: { user: string; context: string }) {
    const doc = await this.assignments.findOne({ user, context });
    if (doc === null) {
      throw new AssignmentNotFound(`${user} holds no role in ${context}`);
    }
    await this.assignments.deleteOne({ _id: doc._id });
    return { assignment: doc._id };
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
    const capabilities = await this.#capabilitiesOf(user, context);
    return { allowed: capabilities.includes(capability) };
  }

  async #holdersOf(context: string, capability: string): Promise<string[]> {
    const assignments = await this.assignments.find({ context }).toArray();
    if (assignments.length === 0) return [];
    const roleIds = [...new Set(assignments.map((doc) => doc.role))];
    const roles = await this.roles.find({ _id: { $in: roleIds } }).toArray();
    const carrying = new Set(
      roles.filter((doc) => doc.capabilities.includes(capability)).map((doc) => doc._id),
    );
    return assignments.filter((doc) => carrying.has(doc.role)).map((doc) => doc.user);
  }

  async _hasCapabilityHolder({ context, capability }: { context: string; capability: string }) {
    return { present: (await this.#holdersOf(context, capability)).length > 0 };
  }

  async _isSoleCapabilityHolder({
    user,
    context,
    capability,
  }: {
    user: string;
    context: string;
    capability: string;
  }) {
    const holders = await this.#holdersOf(context, capability);
    return { sole: holders.length === 1 && holders[0] === user };
  }

  async _holdsRoleNamed({ user, context, name }: { user: string; context: string; name: string }) {
    const role = await this.roles.findOne({ name });
    if (role === null) return { held: false };
    return { held: (await this.assignments.findOne({ user, context, role: role._id })) !== null };
  }

  async _getRole({ user, context }: { user: string; context: string }) {
    const doc = await this.assignments.findOne({ user, context });
    return doc === null ? [] : [{ role: doc.role }];
  }

  async _getContextsOfRoleNamed({ user, name }: { user: string; name: string }) {
    const role = await this.roles.findOne({ name });
    if (role === null) return [];
    const docs = await this.assignments.find({ user, role: role._id }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ context: doc.context }));
  }

  async _getHoldersOfRoleNamed({ context, name }: { context: string; name: string }) {
    const role = await this.roles.findOne({ name });
    if (role === null) return [];
    const docs = await this.assignments
      .find({ context, role: role._id })
      .sort({ seq: 1 })
      .toArray();
    return docs.map((doc) => ({ user: doc.user }));
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
