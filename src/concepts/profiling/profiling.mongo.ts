import type { Collection, Db } from "mongodb";
import { ProfileAlreadyExists, ProfileNotFound } from "./errors.ts";

interface ProfileDoc {
  _id: string;
  displayName: string;
  bio: string;
  avatar: string;
}

export class MongoProfilingConcept {
  private readonly profiles: Collection<ProfileDoc>;

  constructor(db: Db) {
    this.profiles = db.collection<ProfileDoc>("profiling.profiles");
  }

  async createProfile({ user, displayName }: { user: string; displayName: string }) {
    const existing = await this.profiles.findOne({ _id: user });
    if (existing !== null) {
      throw new ProfileAlreadyExists(user);
    }
    await this.profiles.insertOne({ _id: user, displayName, bio: "", avatar: "" });
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
          },
        ];
  }

  async _getProfilesOf({ users }: { users: string[] }) {
    const docs = await this.profiles.find({ _id: { $in: [...users] } }).toArray();
    const found = new Map(docs.map((doc) => [doc._id, doc]));
    const answered: { user: string; displayName: string; bio: string; avatar: string }[] = [];
    const seen = new Set<string>();
    for (const user of users) {
      const doc = found.get(user);
      if (doc === undefined || seen.has(user)) continue;
      seen.add(user);
      answered.push({
        user: doc._id,
        displayName: doc.displayName,
        bio: doc.bio,
        avatar: doc.avatar,
      });
    }
    return answered;
  }
}
