"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Fact, Facts } from "@/components/facts";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireAuth } from "@/components/require-auth";
import { Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { useQuery } from "@/hooks/use-query";
import { api, type Output, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { appHost } from "@/lib/connect";

function ProfileSettings() {
  const { session, me, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(me?.profile.displayName ?? "");
  const [bio, setBio] = useState(me?.profile.bio ?? "");
  const [avatar, setAvatar] = useState(me?.profile.avatar ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!session) return;
    setBusy(true);
    const results = await Promise.all([
      api.profiles.setDisplayName({ displayName: displayName.trim() }),
      api.profiles.setBio({ bio }),
      api.profiles.setAvatar({ avatar: avatar.trim() }),
    ]);
    setBusy(false);
    const failed = results.find((r) => "error" in r);
    if (failed && "error" in failed) {
      toast.error(publicErrorMessage(failed.error));
    } else {
      toast.success("Profile saved");
      await refresh();
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 className="mb-4 font-display text-xl font-semibold">Profile</h2>
      <div className="flex items-center gap-4">
        <UserAvatar
          user={me ? String(me.user) : "me"}
          name={displayName}
          avatar={avatar}
          className="size-16"
        />
        <div className="text-sm text-muted-foreground">
          Your avatar stands beside your name everywhere you post.
        </div>
      </div>
      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        {/* An address that cannot be typed over is not a field. Shown as a
            box, its greyed value read as a hint about what to enter. */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium leading-none">Email</p>
          <p className="text-sm">{me?.email ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            Your email was set when your account was created.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="avatar">Avatar URL</Label>
          <Input
            id="avatar"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="A line about yourself, for the people in this course."
          />
        </div>
        <Button onClick={save} disabled={busy}>
          Save profile
        </Button>
      </div>
    </section>
  );
}

function PasswordSettings() {
  const { session } = useAuth();
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [busy, setBusy] = useState(false);

  async function change() {
    if (!session || !oldPassword || !newPassword) return;
    setBusy(true);
    const result = await api.auth.changePassword({
      oldPassword,
      newPassword,
    });
    setBusy(false);
    if ("error" in result) {
      toast.error(publicErrorMessage(result.error));
    } else {
      toast.success("Password changed");
      setOld("");
      setNew("");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 className="mb-4 font-display text-xl font-semibold">Password</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="old">Current password</Label>
          <Input
            id="old"
            type="password"
            value={oldPassword}
            onChange={(e) => setOld(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new">New password</Label>
          <Input
            id="new"
            type="password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
        </div>
        <Button
          onClick={change}
          disabled={busy || !oldPassword || !newPassword}
          variant="outline"
        >
          Change password
        </Button>
      </div>
    </section>
  );
}

/** The apps this person let sign them in with Commons, and a way to take each back. */
function ConnectedApps() {
  const { session } = useAuth();
  const { data, error, loading, refetch } = useQuery<Output<"/connect/list">>(
    session ? () => api.connect.list() : null,
    [session],
  );
  const connections = data?.connections ?? [];

  async function remove(connection: string, host: string) {
    const result = await api.connect.withdraw({ connection });
    if ("error" in result && result.error !== "NOT_FOUND") {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    // NOT_FOUND is the approval already gone, which is what was asked for.
    toast.success(`Removed ${host}`);
    refetch();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 className="mb-4 font-display text-xl font-semibold">
        Connected apps
      </h2>
      {data === null && loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" /> Loading connected apps…
        </div>
      ) : data === null && error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : connections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No apps can sign you in yet.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {connections.map(({ connection, app, approvedAt }) => {
            const host = appHost(app);
            return (
              <li
                key={connection}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{host}</p>
                  <Facts className="mt-0.5 text-xs">
                    <span className="truncate font-mono text-muted-foreground">
                      {app}
                    </span>
                    <Fact.When verb="Approved" at={approvedAt} />
                  </Facts>
                </div>
                <ConfirmAction
                  trigger={
                    <Button variant="outline" size="sm">
                      Remove
                    </Button>
                  }
                  title={`Remove ${host}?`}
                  description={
                    <p>
                      {host} will have to ask again before it can sign you in.
                      Sessions it has already started are its own, and stay
                      signed in until the app ends them.
                    </p>
                  }
                  confirmLabel="Remove"
                  destructive
                  onConfirm={() => remove(connection, host)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <PageContainer width="narrow">
        <PageHeader
          eyebrow="Account"
          title="Settings"
          description="Manage how you appear and how you sign in."
        />
        <div className="space-y-6">
          <ProfileSettings />
          <PasswordSettings />
          <ConnectedApps />
        </div>
      </PageContainer>
    </RequireAuth>
  );
}
