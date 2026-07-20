import {
  CapabilityRequired,
  GrantAlreadyExists,
  GrantNotFound,
  RoleAlreadyExists,
  RoleNotFound,
} from "./errors.ts";

const freshID = () => crypto.randomUUID();

export class RolingConcept {
  private readonly roles = new Map<string, { name: string; capabilities: string[] }>();
  private readonly grants = new Map<string, { user: string; context: string; role: string }>();

  defineRole({ name, capabilities }: { name: string; capabilities: string[] }) {
    for (const doc of this.roles.values()) {
      if (doc.name === name) {
        throw new RoleAlreadyExists(name);
      }
    }
    const role = freshID();
    this.roles.set(role, { name, capabilities: [...capabilities] });
    return { role };
  }

  ensureRole({ name, capabilities }: { name: string; capabilities: string[] }) {
    for (const [role, doc] of this.roles) {
      if (doc.name === name) return { role };
    }
    const role = freshID();
    this.roles.set(role, { name, capabilities: [...capabilities] });
    return { role };
  }

  grant({ user, context, role }: { user: string; context: string; role: string }) {
    if (!this.roles.has(role)) {
      throw new RoleNotFound(`No role named ${role}`);
    }
    for (const doc of this.grants.values()) {
      if (doc.user === user && doc.context === context && doc.role === role) {
        throw new GrantAlreadyExists(`${user} already holds ${role}`);
      }
    }
    const grant = freshID();
    this.grants.set(grant, { user, context, role });
    return { grant };
  }

  revoke({ user, context, role }: { user: string; context: string; role: string }) {
    for (const [grant, doc] of this.grants) {
      if (doc.user === user && doc.context === context && doc.role === role) {
        this.grants.delete(grant);
        return { grant };
      }
    }
    throw new GrantNotFound(`${user} holds no ${role} in ${context}`);
  }

  requireCapability({
    user,
    context,
    capability,
  }: {
    user: string;
    context: string;
    capability: string;
  }): { allowed: true } {
    const { allowed } = this._hasCapability({ user, context, capability });
    if (!allowed) throw new CapabilityRequired(capability);
    return { allowed: true };
  }

  _hasCapability({
    user,
    context,
    capability,
  }: {
    user: string;
    context: string;
    capability: string;
  }): { allowed: boolean } {
    for (const doc of this.grants.values()) {
      if (doc.user !== user || doc.context !== context) continue;
      if (this.roles.get(doc.role)?.capabilities.includes(capability)) {
        return { allowed: true };
      }
    }
    return { allowed: false };
  }

  _hasCapabilityHolder({ context, capability }: { context: string; capability: string }): {
    present: boolean;
  } {
    for (const doc of this.grants.values()) {
      if (doc.context !== context) continue;
      if (this.roles.get(doc.role)?.capabilities.includes(capability)) {
        return { present: true };
      }
    }
    return { present: false };
  }

  _holdsRoleNamed({ user, context, name }: { user: string; context: string; name: string }): {
    held: boolean;
  } {
    for (const grant of this.grants.values()) {
      if (grant.user !== user || grant.context !== context) continue;
      if (this.roles.get(grant.role)?.name === name) return { held: true };
    }
    return { held: false };
  }

  _getRoles({ user, context }: { user: string; context: string }): { role: string }[] {
    return [...this.grants.values()]
      .filter((doc) => doc.user === user && doc.context === context)
      .map((doc) => ({ role: doc.role }));
  }

  _getRoleByName({ name }: { name: string }): { role: string }[] {
    for (const [role, doc] of this.roles) {
      if (doc.name === name) return [{ role }];
    }
    return [];
  }

  _getRoleDetail({ role }: { role: string }): { name: string; capabilities: string[] }[] {
    const doc = this.roles.get(role);
    return doc === undefined ? [] : [{ name: doc.name, capabilities: [...doc.capabilities] }];
  }

  _listRoles(_: Record<string, never>): { role: string; name: string; capabilities: string[] }[] {
    return [...this.roles.entries()].map(([role, doc]) => ({
      role,
      name: doc.name,
      capabilities: [...doc.capabilities],
    }));
  }

  _denotedRole({ ref }: { ref: string }): { role: string }[] {
    if (this.roles.has(ref)) return [{ role: ref }];
    for (const [role, doc] of this.roles) {
      if (doc.name === ref) return [{ role }];
    }
    return [{ role: ref }];
  }
}
