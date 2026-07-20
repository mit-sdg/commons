import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import { ProfileAlreadyExists, ProfileNotFound } from "./errors.ts";

interface ProfileDoc {
  displayName: string;
  bio: string;
  avatar: string;
  email: string;
}

export class ProfilingConcept {
  static readonly queries = {
    _getProfile: "optional",
    _getProfileFields: "optional",
  } as const satisfies Record<string, QueryPromise>;

  private readonly profiles = new Map<string, ProfileDoc>();

  createProfile({
    user,
    displayName,
    email,
  }: {
    user: string;
    displayName: string;
    email: string;
  }) {
    if (this.profiles.has(user)) {
      throw new ProfileAlreadyExists(user);
    }
    this.profiles.set(user, { displayName, bio: "", avatar: "", email });
    return { user };
  }

  setDisplayName({ user, displayName }: { user: string; displayName: string }) {
    const doc = this.profiles.get(user);
    if (doc === undefined) {
      throw new ProfileNotFound(user);
    }
    doc.displayName = displayName;
    return { user };
  }

  setBio({ user, bio }: { user: string; bio: string }) {
    const doc = this.profiles.get(user);
    if (doc === undefined) {
      throw new ProfileNotFound(user);
    }
    doc.bio = bio;
    return { user };
  }

  setAvatar({ user, avatar }: { user: string; avatar: string }) {
    const doc = this.profiles.get(user);
    if (doc === undefined) {
      throw new ProfileNotFound(user);
    }
    doc.avatar = avatar;
    return { user };
  }

  _getProfile({ user }: { user: string }): { profile: ProfileDoc }[] {
    const doc = this.profiles.get(user);
    return doc === undefined ? [] : [{ profile: { ...doc } }];
  }

  _getProfileFields({ user }: { user: string }): ProfileDoc[] {
    const doc = this.profiles.get(user);
    return doc === undefined ? [] : [{ ...doc }];
  }
}
