import type { Collection, Db } from "mongodb";
import { ProfileAlreadyExists, ProfileNotFound } from "./errors.ts";

interface ProfileDoc {
  _id: string;
  displayName: string;
  bio: string;
  avatar: string;
  email: string;
}

export class MongoProfilingConcept {
  private readonly profiles: Collection<ProfileDoc>;

  constructor(db: Db) {
    this.profiles = db.collection<ProfileDoc>("profiling.profiles");
  }

  async createProfile({
    user,
    displayName,
    email,
  }: {
    user: string;
    displayName: string;
    email: string;
  }) {
    const existing = await this.profiles.findOne({ _id: user });
    if (existing !== null) {
      throw new ProfileAlreadyExists(user);
    }
    await this.profiles.insertOne({ _id: user, displayName, bio: "", avatar: "", email });
    return { user };
  }
  async setDisplayName({ user, displayName }: { user: string; displayName: string }) {
    const updated = await this.profiles.updateOne({ _id: user }, { $set: { displayName } });
    if (updated.matchedCount === 0) {
      throw new ProfileNotFound(user);
    }
    return { user };
  }

  async setBio({ user, bio }: { user: string; bio: string }) {
    const updated = await this.profiles.updateOne({ _id: user }, { $set: { bio } });
    if (updated.matchedCount === 0) {
      throw new ProfileNotFound(user);
    }
    return { user };
  }

  async setAvatar({ user, avatar }: { user: string; avatar: string }) {
    const updated = await this.profiles.updateOne({ _id: user }, { $set: { avatar } });
    if (updated.matchedCount === 0) {
      throw new ProfileNotFound(user);
    }
    return { user };
  }

  async _getProfile({ user }: { user: string }) {
    const doc = await this.profiles.findOne({ _id: user });
    return doc === null
      ? []
      : [
          {
            profile: {
              displayName: doc.displayName,
              bio: doc.bio,
              avatar: doc.avatar,
              email: doc.email,
            },
          },
        ];
  }

  async _getProfileFields({ user }: { user: string }) {
    const doc = await this.profiles.findOne({ _id: user });
    return doc === null
      ? []
      : [
          {
            displayName: doc.displayName,
            bio: doc.bio,
            avatar: doc.avatar,
            email: doc.email,
          },
        ];
  }
}
