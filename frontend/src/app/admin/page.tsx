"use client";

import {
  Archive,
  ArchiveRestore,
  FolderPlus,
  List,
  Mail,
  MailPlus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  TriangleAlert,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { CategoryDot } from "@/components/forum/badges";
import { PageContainer, PageHeader } from "@/components/page";
import { EmptyState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { UserName } from "@/components/user-name";
import type { QueryState } from "@/hooks/use-query";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { FORUM_CONTEXT, useAuth } from "@/lib/auth";
import { fullTime, relativeTime, shortId } from "@/lib/format";
import type {
  Category,
  Invitation,
  MailMessage,
  RegisteredUser,
  RoleDetail,
  RoleRow,
  RoleSummary,
} from "@/lib/models";
import { cn } from "@/lib/utils";

const CAPABILITY_INFO: Record<string, string> = {
  administer:
    "Full administrative access — manage roles, categories, and forum configuration.",
  moderate:
    "Content moderation — lock threads, trash posts, and manage categories.",
  pin: "Pin threads to the top of category listings.",
};

function UserRoleBadges({
  roles,
  rolesMap,
}: {
  roles?: { role: string }[];
  rolesMap: Record<string, RoleSummary>;
}) {
  if (!roles || roles.length === 0) {
    return (
      <Badge
        variant="outline"
        className="text-xs text-muted-foreground font-normal"
      >
        Member
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => {
        const roleKey = String(r.role);
        const roleSummary = rolesMap[roleKey];
        const roleName = roleSummary?.name ?? shortId(roleKey);
        return (
          <Badge
            key={roleKey}
            variant="secondary"
            className="text-xs font-medium capitalize"
          >
            {roleName}
          </Badge>
        );
      })}
    </div>
  );
}

function InviteMembersSection({ onInvited }: { onInvited: () => void }) {
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  async function sendInvitations() {
    const unique = [
      ...new Set(
        emails
          .split(/[\s,;]+/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (unique.length === 0) return;
    setBusy(true);
    let sent = 0;
    for (const email of unique) {
      const result = await api.invitations.invite({ email });
      if ("error" in result)
        toast.error(`${email}: ${publicErrorMessage(result.error)}`);
      else sent += 1;
    }
    setBusy(false);
    if (sent > 0)
      toast.success(`${sent} invitation${sent === 1 ? "" : "s"} queued.`);
    setEmails("");
    onInvited();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
          <MailPlus className="size-5 text-primary" /> Invite members
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
          className="text-xs text-muted-foreground"
        >
          {isOpen ? "Collapse" : "Expand"}
        </Button>
      </div>

      {isOpen ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            Enter email addresses separated by spaces, commas, or new lines.
            Re-inviting a pending address sends the same temporary password
            again.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="invite-emails">Email addresses</Label>
            <textarea
              id="invite-emails"
              className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
              placeholder="alice@example.edu, bob@example.edu"
            />
          </div>
          <Button
            size="sm"
            disabled={busy || !emails.trim()}
            onClick={sendInvitations}
          >
            {busy ? "Queuing…" : "Send invitations"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function RegisteredUsersView({
  usersQuery,
  onInspectRoles,
  rolesMap,
  currentUser,
}: {
  usersQuery: QueryState<{ users: RegisteredUser[] }>;
  onInspectRoles: (username: string) => void;
  rolesMap: Record<string, RoleSummary>;
  currentUser: string | null;
}) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function setArchived(
    user: string,
    label: string,
    archive: boolean,
  ): Promise<void> {
    setBusy((prev) => ({ ...prev, [user]: true }));
    try {
      const result = archive
        ? await api.users.archive({ user })
        : await api.users.restore({ user });
      if ("error" in result) {
        toast.error(publicErrorMessage(result.error));
      } else {
        toast.success(archive ? `${label} archived` : `${label} restored`);
      }
      usersQuery.refetch();
    } finally {
      setBusy((prev) => ({ ...prev, [user]: false }));
    }
  }

  const users = useMemo(() => usersQuery.data?.users ?? [], [usersQuery.data]);
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  if (usersQuery.loading) {
    return <LoadingState />;
  }

  if (usersQuery.error) {
    return (
      <EmptyState
        icon={Users}
        title="Failed to load users"
        description={usersQuery.error}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, @username, or email…"
            className="pl-9 pr-9"
          />
          {search ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No registered users"
          description="No users have registered yet."
        />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No users found"
          description={`No users matching "${search}".`}
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {filteredUsers.map((u) => {
            const id = String(u.user);
            const label = u.displayName ?? u.username;
            const isSelf = currentUser !== null && id === currentUser;
            return (
              <div
                key={id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    user={id}
                    name={label}
                    avatar={u.avatar ?? undefined}
                    className={cn(
                      "size-10 shrink-0",
                      u.archived && "grayscale",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <UserName
                        user={id}
                        name={label}
                        className={cn(
                          "font-medium truncate",
                          u.archived && "text-muted-foreground",
                        )}
                      />
                      <span className="text-xs text-muted-foreground font-mono">
                        @{u.username}
                      </span>
                      {u.archived ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium"
                        >
                          Archived
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {u.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end">
                  <UserRoleBadges roles={u.roles} rolesMap={rolesMap} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => onInspectRoles(u.username)}
                  >
                    <Shield className="size-3.5" />
                    Inspect roles
                  </Button>
                  {u.archived ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={!!busy[id]}
                      onClick={() => setArchived(id, label, false)}
                    >
                      <ArchiveRestore className="size-3.5" />
                      Restore
                    </Button>
                  ) : isSelf ? null : (
                    <ConfirmAction
                      title={`Archive ${label}?`}
                      description="They will be signed out of every device and will not be able to sign in again. Their posts, tasks, and profile are kept, and you can restore them at any time."
                      confirmLabel="Archive account"
                      destructive
                      onConfirm={() => setArchived(id, label, true)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={!!busy[id]}
                        >
                          <Archive className="size-3.5" />
                          Archive
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PendingInvitationsView({
  invitationsQuery,
}: {
  invitationsQuery: QueryState<{ invitations: Invitation[] }>;
}) {
  const [resending, setResending] = useState<Record<string, boolean>>({});

  const allInvitations = useMemo(
    () => invitationsQuery.data?.invitations ?? [],
    [invitationsQuery.data],
  );
  const pendingInvitations = useMemo(
    () => allInvitations.filter((i) => i.user === null),
    [allInvitations],
  );

  async function resendInvitation(address: string) {
    setResending((prev) => ({ ...prev, [address]: true }));
    try {
      const result = await api.invitations.invite({ email: address });
      if ("error" in result) {
        toast.error(`${address}: ${publicErrorMessage(result.error)}`);
      } else {
        toast.success(`Invitation resent to ${address}`);
        invitationsQuery.refetch();
      }
    } finally {
      setResending((prev) => ({ ...prev, [address]: false }));
    }
  }

  async function retractInvitation(invitationId: string, address: string) {
    const result = await api.invitations.retract({
      invitation: invitationId,
    });
    if ("error" in result) {
      // The boundary reports a vanished invitation as NOT_FOUND and an
      // already-claimed one as CONFLICT; both mean this row is stale, so say
      // that rather than a generic failure, and refresh the list.
      if (result.error === "NOT_FOUND" || result.error === "CONFLICT") {
        toast.error(
          `The invitation for ${address} is no longer pending. Refreshing the list.`,
        );
        invitationsQuery.refetch();
      } else {
        toast.error(publicErrorMessage(result.error));
      }
    } else {
      toast.success(`Invitation for ${address} retracted`);
      invitationsQuery.refetch();
    }
  }

  if (invitationsQuery.loading) {
    return <LoadingState />;
  }

  if (invitationsQuery.error) {
    return (
      <EmptyState
        icon={Mail}
        title="Failed to load invitations"
        description={invitationsQuery.error}
      />
    );
  }

  if (pendingInvitations.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No pending invitations"
        description="All invitations have been claimed or none have been sent."
      />
    );
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
      {pendingInvitations.map((invitation) => {
        const address = invitation.address;
        const invId = String(invitation.invitation);
        const isResending = !!resending[address];

        return (
          <div
            key={invId}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-foreground">{address}</p>
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium"
                >
                  Pending
                </Badge>
              </div>
              <p
                className="text-xs text-muted-foreground mt-0.5"
                title={
                  invitation.createdAt
                    ? fullTime(invitation.createdAt)
                    : undefined
                }
              >
                Invited {invitation.inviteCount} time
                {invitation.inviteCount === 1 ? "" : "s"}
                {invitation.createdAt
                  ? ` · Created ${relativeTime(invitation.createdAt)}`
                  : ""}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={isResending}
                onClick={() => resendInvitation(address)}
              >
                <RefreshCw
                  className={cn("size-3.5", isResending && "animate-spin")}
                />
                {isResending ? "Resending…" : "Resend"}
              </Button>

              <ConfirmAction
                title={`Retract invitation for ${address}?`}
                description="This will invalidate the invitation link and temporary password. The user will no longer be able to use it to register."
                confirmLabel="Retract invitation"
                destructive
                onConfirm={() => retractInvitation(invId, address)}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                    Retract
                  </Button>
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UsersAndInvitationsAdmin({
  onInspectRoles,
  rolesMap,
  currentUser,
}: {
  onInspectRoles: (username: string) => void;
  rolesMap: Record<string, RoleSummary>;
  currentUser: string | null;
}) {
  const [subView, setSubView] = useState<"users" | "invitations">("users");

  const usersQuery = useQuery<{ users: RegisteredUser[] }>(
    () => api.users.list({}),
    [],
  );
  const invitationsQuery = useQuery<{ invitations: Invitation[] }>(
    () => api.invitations.list({}),
    [],
  );

  const registeredCount = usersQuery.data?.users?.length ?? 0;
  const pendingCount = useMemo(
    () =>
      invitationsQuery.data?.invitations?.filter((i) => i.user === null)
        .length ?? 0,
    [invitationsQuery.data],
  );

  return (
    <div className="space-y-6">
      <InviteMembersSection
        onInvited={() => {
          invitationsQuery.refetch();
          usersQuery.refetch();
        }}
      />

      <div className="space-y-4">
        <Tabs
          value={subView}
          onValueChange={(val) => setSubView(val as "users" | "invitations")}
        >
          <TabsList className="w-full">
            <TabsTrigger value="users" className="gap-1.5 sm:gap-2">
              <Users className="size-4 shrink-0" />
              <span className="sm:hidden" aria-hidden="true">
                Users
              </span>
              <span className="hidden sm:inline">Registered Users</span>
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0.5 text-xs font-semibold shrink-0"
              >
                {usersQuery.loading ? "…" : registeredCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="invitations" className="gap-1.5 sm:gap-2">
              <Mail className="size-4 shrink-0" />
              <span className="sm:hidden" aria-hidden="true">
                Invitations
              </span>
              <span className="hidden sm:inline">Pending Invitations</span>
              <Badge
                variant="secondary"
                className="ml-1 px-1.5 py-0.5 text-xs font-semibold shrink-0"
              >
                {invitationsQuery.loading ? "…" : pendingCount}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <RegisteredUsersView
              usersQuery={usersQuery}
              onInspectRoles={onInspectRoles}
              rolesMap={rolesMap}
              currentUser={currentUser}
            />
          </TabsContent>

          <TabsContent value="invitations" className="mt-4">
            <PendingInvitationsView invitationsQuery={invitationsQuery} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CategoryAdmin() {
  const { session } = useAuth();
  const { data, refetch } = useQuery<{ categories: Category[] }>(
    () => api.categories.list({}),
    [],
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function create() {
    if (!session || !name.trim()) return;
    const result = await api.categories.create({
      name: name.trim(),
      description: description.trim(),
    });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Category created");
      setName("");
      setDescription("");
      refetch();
    }
  }

  async function remove(category: string) {
    if (!session) return;
    const result = await api.categories.delete({ category });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Category deleted");
      refetch();
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <FolderPlus className="size-5" />
          New category
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Announcements"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-desc">Description</Label>
            <Input
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What belongs here?"
            />
          </div>
        </div>
        <Button className="mt-4" onClick={create} disabled={!name.trim()}>
          Create category
        </Button>
      </section>

      <section>
        <h3 className="eyebrow mb-3">Existing categories</h3>
        {!data || data.categories.length === 0 ? (
          <EmptyState
            title="No categories"
            description="Create your first category above."
          />
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {data.categories.map((category) => (
              <div
                key={String(category.category)}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="flex items-center gap-2.5">
                  <CategoryDot
                    id={String(category.category)}
                    className="size-3.5"
                  />
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {category.description || "No description"}
                    </p>
                  </div>
                </div>
                <ConfirmAction
                  title={`Delete ${category.name}?`}
                  description="This removes the category. Discussions and posts are not deleted."
                  confirmLabel="Delete category"
                  destructive
                  onConfirm={() => remove(String(category.category))}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RoleAdmin({
  initialInspectUser,
  roleList,
}: {
  initialInspectUser?: string | null;
  roleList: QueryState<{ roles: RoleSummary[] }>;
}) {
  const { session } = useAuth();
  const [roleName, setRoleName] = useState("");
  const [caps, setCaps] = useState<string[]>([]);
  const [grantUser, setGrantUser] = useState("");
  const [grantRole, setGrantRole] = useState("");
  const [lookupUser, setLookupUser] = useState(initialInspectUser ?? "");
  const [queryUser, setQueryUser] = useState<string | null>(
    initialInspectUser ?? null,
  );
  const [queryUsername, setQueryUsername] = useState<string | null>(
    initialInspectUser ?? null,
  );
  const [roleDetails, setRoleDetails] = useState<Record<string, RoleDetail>>(
    {},
  );
  const fetchedRef = useRef<Set<string>>(new Set());

  function resetInspection() {
    setRoleDetails({});
    fetchedRef.current.clear();
  }

  const roles = useQuery<{ roles: RoleRow[] }>(
    queryUser
      ? () => api.roles.forUser({ user: queryUser, context: FORUM_CONTEXT })
      : null,
    [queryUser],
  );

  useEffect(() => {
    if (!roles.data) return;
    Promise.all(
      roles.data.roles.map(async (r) => {
        const key = String(r.role);
        if (fetchedRef.current.has(key)) return;
        fetchedRef.current.add(key);
        const result = await api.roles.get({ role: key });
        if (!("error" in result)) {
          setRoleDetails((prev) => ({ ...prev, [key]: result }));
        }
      }),
    );
  }, [roles.data]);

  function toggleCap(cap: string) {
    setCaps((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
  }

  async function define() {
    if (!session || !roleName.trim() || caps.length === 0) return;
    const result = await api.roles.define({
      name: roleName.trim(),
      capabilities: caps,
    });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(`Role "${roleName.trim()}" defined`);
      setRoleName("");
      setCaps([]);
      roleList.refetch();
    }
  }

  async function grant() {
    if (!session || !grantUser.trim() || !grantRole.trim()) return;
    const result = await api.roles.grant({
      user: grantUser.trim(),
      context: FORUM_CONTEXT,
      role: grantRole.trim(),
    });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Role granted");
      setGrantUser("");
      setGrantRole("");
      if (queryUser === grantUser.trim()) {
        resetInspection();
        roles.refetch();
      }
    }
  }

  async function revoke(role: string) {
    if (!session || !queryUser) return;
    const result = await api.roles.revoke({
      user: queryUser,
      context: FORUM_CONTEXT,
      role,
    });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Role revoked");
      resetInspection();
      roles.refetch();
    }
  }

  const CAPABILITIES = Object.keys(CAPABILITY_INFO);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <Shield className="size-5" />
          Define a role
        </h3>
        <div className="space-y-2">
          <Label htmlFor="role-name">Role name</Label>
          <Input
            id="role-name"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g. moderator"
          />
        </div>
        <div className="mt-4 space-y-3">
          <Label>Capabilities</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {CAPABILITIES.map((cap) => {
              const selected = caps.includes(cap);
              return (
                <button
                  key={cap}
                  type="button"
                  onClick={() => toggleCap(cap)}
                  className={
                    "rounded-lg border p-3 text-left transition-colors " +
                    (selected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted")
                  }
                >
                  <p className="text-sm font-medium capitalize">{cap}</p>
                  <p className="mt-0.5 text-xs leading-relaxed opacity-70">
                    {CAPABILITY_INFO[cap]}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={define}
          disabled={!roleName.trim() || caps.length === 0}
        >
          Define role
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <UserCog className="size-5" />
          Grant a role
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="grant-user">Username</Label>
            <Input
              id="grant-user"
              value={grantUser}
              onChange={(e) => setGrantUser(e.target.value)}
              placeholder="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grant-role">Role (name or ID)</Label>
            <Input
              id="grant-role"
              value={grantRole}
              onChange={(e) => setGrantRole(e.target.value)}
              placeholder="e.g. moderator"
              list="grant-role-suggestions"
            />
            {roleList.data && roleList.data.roles.length > 0 ? (
              <datalist id="grant-role-suggestions">
                {roleList.data.roles.map((r) => (
                  <option key={String(r.role)} value={r.name} />
                ))}
              </datalist>
            ) : null}
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={grant}
          disabled={!grantUser.trim() || !grantRole.trim()}
        >
          Grant role
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
          <List className="size-5" />
          Defined roles
        </h3>
        {roleList.loading ? (
          <LoadingState />
        ) : !roleList.data || roleList.data.roles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No roles defined yet. Create one above.
          </p>
        ) : (
          <div className="space-y-2">
            {roleList.data.roles.map((r) => (
              <div
                key={String(r.role)}
                className="flex items-start justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium capitalize">{r.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                    {shortId(String(r.role))}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.capabilities.map((cap: string) => (
                      <Badge
                        key={cap}
                        variant="secondary"
                        className="text-xs capitalize"
                      >
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-display text-lg font-semibold">
          Inspect a user&apos;s roles
        </h3>
        <div className="flex gap-2">
          <Input
            value={lookupUser}
            onChange={(e) => setLookupUser(e.target.value)}
            placeholder="username"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const name = lookupUser.trim();
                if (name) {
                  setQueryUser(name);
                  setQueryUsername(name);
                  resetInspection();
                }
              }
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              const name = lookupUser.trim();
              if (name) {
                setQueryUser(name);
                setQueryUsername(name);
                resetInspection();
              }
            }}
            disabled={!lookupUser.trim()}
          >
            Look up
          </Button>
        </div>
        {queryUser ? (
          <div className="mt-4">
            <p className="mb-2 text-sm text-muted-foreground">
              Roles for{" "}
              <UserName user={queryUser} className="text-foreground" /> (
              {queryUsername ?? shortId(queryUser)})
            </p>
            {roles.loading ? (
              <LoadingState />
            ) : !roles.data || roles.data.roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No roles in this context.
              </p>
            ) : (
              <ul className="space-y-2">
                {roles.data.roles.map((r) => {
                  const detail = roleDetails[String(r.role)];
                  return (
                    <li
                      key={String(r.role)}
                      className="flex items-start justify-between rounded-lg border border-border px-4 py-3"
                    >
                      <div className="min-w-0">
                        {detail ? (
                          <>
                            <p className="font-medium capitalize">
                              {detail.name}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                              {shortId(String(r.role))}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {detail.capabilities.map((cap: string) => (
                                <Badge
                                  key={cap}
                                  variant="secondary"
                                  className="text-xs capitalize"
                                >
                                  {cap}
                                </Badge>
                              ))}
                            </div>
                          </>
                        ) : (
                          <span className="font-mono text-sm">
                            {shortId(String(r.role))}
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive shrink-0"
                        onClick={() => revoke(String(r.role))}
                      >
                        Revoke
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}

/** A queued message is failing when it has an error recorded and never landed. */
function isFailing(m: MailMessage): boolean {
  return m.sentAt === null && m.lastError !== null;
}

function MailStatusBadge({ message }: { message: MailMessage }) {
  if (message.sentAt !== null) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium"
      >
        Sent
      </Badge>
    );
  }
  if (message.lastError !== null) {
    return (
      <Badge
        variant="outline"
        className="border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium"
      >
        Failing
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium"
    >
      Queued
    </Badge>
  );
}

function MailAdmin({
  mailQuery,
}: {
  mailQuery: QueryState<{ messages: MailMessage[] }>;
}) {
  const [onlyFailing, setOnlyFailing] = useState(false);

  const messages = useMemo(
    () => mailQuery.data?.messages ?? [],
    [mailQuery.data],
  );
  const failing = useMemo(() => messages.filter(isFailing), [messages]);
  const shown = onlyFailing ? failing : messages;

  if (mailQuery.loading) return <LoadingState />;
  if (mailQuery.error) {
    return (
      <EmptyState
        icon={Mail}
        title="Failed to load the outbox"
        description={mailQuery.error}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Every email Commons has queued, newest first.{" "}
          {failing.length > 0 ? (
            <span className="text-destructive font-medium">
              {failing.length}{" "}
              {failing.length === 1 ? "message is" : "messages are"} not getting
              through.
            </span>
          ) : (
            <span>Nothing is currently failing.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={onlyFailing ? "default" : "outline"}
            size="sm"
            className="gap-1.5 text-xs"
            disabled={failing.length === 0 && !onlyFailing}
            onClick={() => setOnlyFailing((prev) => !prev)}
          >
            <TriangleAlert className="size-3.5" />
            {onlyFailing ? "Showing failures" : "Only failures"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => mailQuery.refetch()}
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Mail}
          title={onlyFailing ? "No failing messages" : "No email yet"}
          description={
            onlyFailing
              ? "Every queued message has been delivered."
              : "Commons has not queued any email yet."
          }
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {shown.map((m) => (
            <div key={String(m.message)} className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{m.subject}</p>
                <MailStatusBadge message={m} />
                {m.attempts > 1 ? (
                  <span className="text-xs text-muted-foreground">
                    {m.attempts} attempts
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                To {m.recipient} · Queued{" "}
                <span title={fullTime(m.createdAt)}>
                  {relativeTime(m.createdAt)}
                </span>
                {m.sentAt !== null ? (
                  <>
                    {" "}
                    · Sent{" "}
                    <span title={fullTime(m.sentAt)}>
                      {relativeTime(m.sentAt)}
                    </span>
                  </>
                ) : null}
                {m.sentAt === null && m.lastAttemptAt !== null ? (
                  <>
                    {" "}
                    · Last tried{" "}
                    <span title={fullTime(m.lastAttemptAt)}>
                      {relativeTime(m.lastAttemptAt)}
                    </span>
                  </>
                ) : null}
              </p>
              {m.lastError !== null && m.sentAt === null ? (
                <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive break-words">
                  {m.lastError}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { loading, can, me } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("users");
  const [inspectUser, setInspectUser] = useState<string | null>(null);

  const roleList = useQuery<{ roles: RoleSummary[] }>(
    () => api.roles.list({}),
    [],
  );
  const mailQuery = useQuery<{ messages: MailMessage[] }>(
    () => api.mail.list({}),
    [],
  );

  const failingMail = useMemo(
    () => (mailQuery.data?.messages ?? []).filter(isFailing).length,
    [mailQuery.data],
  );

  const rolesMap = useMemo(() => {
    const map: Record<string, RoleSummary> = {};
    if (roleList.data?.roles) {
      for (const r of roleList.data.roles) {
        map[String(r.role)] = r;
      }
    }
    return map;
  }, [roleList.data]);

  function handleInspectRoles(username: string) {
    setInspectUser(username);
    setActiveTab("roles");
  }

  if (loading)
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );

  if (!can.administer)
    return (
      <PageContainer>
        <EmptyState
          icon={Shield}
          title="Administrators only"
          description="You don't have permission to view the admin console."
        />
      </PageContainer>
    );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Console"
        title="Administration"
        description="Manage users, invitations, categories, roles, and outgoing email."
      />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger
            value="users"
            className="gap-1.5 px-1.5 sm:gap-2 sm:px-2"
          >
            <Users className="size-4 shrink-0" />
            <span className="sm:hidden" aria-hidden="true">
              Users
            </span>
            <span className="hidden sm:inline">Users & Invitations</span>
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="gap-1.5 px-1.5 sm:gap-2 sm:px-2"
          >
            <FolderPlus className="size-4 shrink-0" />
            Categories
          </TabsTrigger>
          <TabsTrigger
            value="roles"
            className="gap-1.5 px-1.5 sm:gap-2 sm:px-2"
          >
            <Shield className="size-4 shrink-0" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="mail" className="gap-1.5 px-1.5 sm:gap-2 sm:px-2">
            <Mail className="size-4 shrink-0" />
            Email
            {failingMail > 0 ? (
              <Badge
                variant="outline"
                className="ml-1 border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold text-destructive shrink-0"
              >
                {failingMail}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6">
          <UsersAndInvitationsAdmin
            onInspectRoles={handleInspectRoles}
            rolesMap={rolesMap}
            currentUser={me ? String(me.user) : null}
          />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <CategoryAdmin />
        </TabsContent>
        <TabsContent value="roles" className="mt-6">
          <RoleAdmin
            key={inspectUser ?? "default"}
            initialInspectUser={inspectUser}
            roleList={roleList}
          />
        </TabsContent>
        <TabsContent value="mail" className="mt-6">
          <MailAdmin mailQuery={mailQuery} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
