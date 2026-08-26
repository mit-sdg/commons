"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AddPersonForm } from "@/components/lms/add-person";
import { CsvImport } from "@/components/lms/csv-import";
import { RemoveSeatDialog } from "@/components/lms/remove-seat";
import { RosterTable } from "@/components/lms/roster-table";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@/hooks/use-query";
import type { Output } from "@/lib/api";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  loadDroppedRoster,
  loadPendingRoster,
  loadRosterList,
  loadSections,
} from "@/lib/lms";
import {
  isSelfAddRequest,
  SELF_ADD_PARAM,
  seatKindOptions,
} from "@/lib/roster-people";

function SectionManager({
  data,
  onUpdate,
}: {
  data: {
    sections: {
      section: string;
      name: string;
      location?: string;
      meetingPattern?: string;
      status: string;
    }[];
  } | null;
  onUpdate: () => void;
}) {
  const { session } = useAuth();

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [meetingPattern, setMeetingPattern] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editMeetingPattern, setEditMeetingPattern] = useState("");

  async function create() {
    if (!session || !name.trim()) return;
    setLoading(true);
    const result = await api.roster["sections/create"]({
      name: name.trim(),
      location,
      meetingPattern,
    });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Section created");
      setName("");
      setLocation("");
      setMeetingPattern("");
      onUpdate();
    }
  }

  async function update() {
    if (!session || !editing || !editName.trim()) return;
    setLoading(true);
    const result = await api.roster["sections/update"]({
      section: editing,
      name: editName.trim(),
      location: editLocation.trim(),
      meetingPattern: editMeetingPattern.trim(),
    });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Section updated");
      setEditing(null);
      onUpdate();
    }
  }

  function beginEditing(section: {
    section: string;
    name: string;
    location?: string;
    meetingPattern?: string;
  }) {
    setEditing(section.section);
    setEditName(section.name);
    setEditLocation(section.location ?? "");
    setEditMeetingPattern(section.meetingPattern ?? "");
  }

  const sections = data?.sections ?? [];
  const activeSections = sections.filter((s) => s.status === "ACTIVE");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sections</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="section-name">Name</Label>
            <Input
              id="section-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Section 01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="section-location">Location (optional)</Label>
            <Input
              id="section-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Room 101"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="section-meeting">Meeting pattern (optional)</Label>
            <Input
              id="section-meeting"
              value={meetingPattern}
              onChange={(e) => setMeetingPattern(e.target.value)}
              placeholder="MWF 10:00-10:50"
            />
          </div>
        </div>
        <Button size="sm" onClick={create} disabled={loading || !name.trim()}>
          <Plus className="size-4 mr-1" /> Create Section
        </Button>

        {activeSections.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-muted-foreground">Active sections:</p>
            {activeSections.map((section) =>
              editing === section.section ? (
                <div
                  key={section.section}
                  className="space-y-3 rounded-lg border border-primary/30 bg-muted/25 p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`edit-name-${section.section}`}>
                        Name
                      </Label>
                      <Input
                        id={`edit-name-${section.section}`}
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`edit-location-${section.section}`}>
                        Location
                      </Label>
                      <Input
                        id={`edit-location-${section.section}`}
                        value={editLocation}
                        onChange={(event) =>
                          setEditLocation(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`edit-meeting-${section.section}`}>
                        Meeting pattern
                      </Label>
                      <Input
                        id={`edit-meeting-${section.section}`}
                        value={editMeetingPattern}
                        onChange={(event) =>
                          setEditMeetingPattern(event.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={update}
                      disabled={loading || !editName.trim()}
                    >
                      Save section
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  key={section.section}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{section.name}</span>
                    {section.location ? (
                      <span className="ml-2 text-muted-foreground">
                        {section.location}
                      </span>
                    ) : null}
                    {section.meetingPattern ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {section.meetingPattern}
                      </span>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => beginEditing(section)}
                  >
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                </div>
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PendingSeats({
  members,
  onUpdate,
}: {
  members: Output<"/roster/pending">["members"];
  onUpdate: () => void;
}) {
  const [linking, setLinking] = useState<string | null>(null);
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);

  async function link() {
    if (!linking || !account.trim()) return;
    setBusy(true);
    const resolved = await api.users.resolve({ ref: account.trim() });
    if ("error" in resolved) {
      setBusy(false);
      toast.error(publicErrorMessage(resolved.error));
      return;
    }
    const result = await api.roster.enroll({
      email: linking,
      user: String(resolved.user),
    });
    setBusy(false);
    if ("error" in result) {
      // The edge answers a bare CONFLICT here, and on this form it means one of
      // two things worth naming rather than "that change cannot be made".
      toast.error(
        result.error === "CONFLICT"
          ? `@${resolved.username} already holds a seat on this roster.`
          : publicErrorMessage(result.error),
      );
    } else {
      toast.success(`Enrolled @${resolved.username}`);
      setLinking(null);
      setAccount("");
      onUpdate();
    }
  }

  if (members.length === 0) {
    return (
      <EmptyState
        title="No pending seats"
        description="Imported seats that have not been claimed appear here."
      />
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={String(member.seat)}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              {/* A seat carries the name staff typed for it until somebody
                  accepts and a profile owns what they are called. */}
              {member.displayName ? (
                <>
                  <p className="font-medium">{member.displayName}</p>
                  <p className="text-sm text-muted-foreground break-all">
                    {member.email}
                  </p>
                </>
              ) : (
                <p className="font-medium break-all">{member.email}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {member.kind.toLowerCase()} · invitation pending
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLinking(String(member.email));
                  setAccount("");
                }}
              >
                Enrol account
              </Button>
              <RemoveSeatDialog
                seat={String(member.seat)}
                person={String(member.email)}
                onRemoved={onUpdate}
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </Button>
                }
              />
            </div>
          </div>
          {linking === String(member.email) ? (
            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`link-account-${member.seat}`}>
                  Username or user ID
                </Label>
                <Input
                  id={`link-account-${member.seat}`}
                  value={account}
                  onChange={(event) => setAccount(event.target.value)}
                  placeholder="ada"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={link}
                  disabled={busy || !account.trim()}
                >
                  {busy ? "Enrolling…" : "Enrol"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setLinking(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DroppedSeats({
  members,
  onUpdate,
}: {
  members: Output<"/roster/dropped">["members"];
  onUpdate: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function reinstate(seat: string) {
    setBusy(seat);
    const result = await api.roster.reinstate({ seat });
    setBusy(null);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Seat reinstated");
      onUpdate();
    }
  }

  if (members.length === 0) {
    return (
      <EmptyState
        title="No dropped seats"
        description="Dropped learners and staff appear here for recovery."
      />
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={String(member.seat)}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div>
            <p className="font-medium">{member.displayName ?? member.email}</p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {member.kind.toLowerCase()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => reinstate(String(member.seat))}
              disabled={busy === String(member.seat)}
            >
              {busy === String(member.seat) ? "Reinstating…" : "Reinstate"}
            </Button>
            <RemoveSeatDialog
              seat={String(member.seat)}
              person={member.displayName ?? String(member.email)}
              onRemoved={onUpdate}
              trigger={
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RosterPageContent() {
  const { session, me } = useAuth();
  const searchParams = useSearchParams();
  const selfAdd = isSelfAddRequest(searchParams.get(SELF_ADD_PARAM));
  const [tab, setTab] = useState(selfAdd ? "add" : "sections");
  const refreshTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const {
    data: rosterData,
    loading,
    error,
    refetch,
  } = useQuery(session ? () => loadRosterList() : null, [session]);

  const pendingQuery = useQuery(session ? () => loadPendingRoster() : null, [
    session,
  ]);
  const droppedQuery = useQuery(session ? () => loadDroppedRoster() : null, [
    session,
  ]);

  const sectionsQuery = useQuery<{
    sections: {
      section: string;
      name: string;
      location?: string;
      meetingPattern?: string;
      status: string;
    }[];
  }>(() => loadSections(), []);

  const members = rosterData?.members ?? [];
  const activeMembers = members.filter(
    (member): member is typeof member & { user: string } =>
      member.user !== null,
  );
  const sections = sectionsQuery.data?.sections ?? [];
  const pendingMembers = pendingQuery.data?.members ?? [];
  const droppedMembers = droppedQuery.data?.members ?? [];
  const kinds = seatKindOptions([
    ...members.map((member) => String(member.kind)),
    ...pendingMembers.map((member) => String(member.kind)),
    ...droppedMembers.map((member) => String(member.kind)),
  ]);
  // The affordance carries only the intent to add oneself; the address and the
  // name come from the session read, so a shared link adds nobody and fills in
  // whoever follows it.
  const prefill = selfAdd
    ? {
        email: String(me?.email ?? ""),
        displayName: String(me?.profile.displayName ?? ""),
        kind: "STAFF",
        self: true,
      }
    : null;

  function refetchRoster() {
    refetch();
    pendingQuery.refetch();
    droppedQuery.refetch();
  }

  function refreshRosterAfterAdd() {
    for (const timer of refreshTimers.current) clearTimeout(timer);
    refreshTimers.current = [];
    refetchRoster();
    // Claiming a live account's seat runs after AddPerson answers. Refresh until
    // that consequence has had time to move the seat out of Pending.
    for (const delay of [200, 750, 2_000]) {
      refreshTimers.current.push(setTimeout(refetchRoster, delay));
    }
  }

  useEffect(
    () => () => {
      for (const timer of refreshTimers.current) clearTimeout(timer);
    },
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Staff"
        title="Roster management"
        description="Manage sections and enrolment, and maintain member access."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <p className="mb-2 text-xs text-muted-foreground sm:hidden">
          Scroll tabs sideways for more roster views →
        </p>
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full">
            <TabsTrigger value="sections">Sections</TabsTrigger>
            <TabsTrigger value="active">
              Active ({activeMembers.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({pendingMembers.length})
            </TabsTrigger>
            <TabsTrigger value="dropped">
              Dropped ({droppedMembers.length})
            </TabsTrigger>
            <TabsTrigger value="add">Add people</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="sections" className="mt-6">
          <SectionManager
            data={sectionsQuery.data}
            onUpdate={sectionsQuery.refetch}
          />
        </TabsContent>

        <TabsContent value="active" className="mt-6">
          {loading ? (
            <LoadingState label="Loading roster..." />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : activeMembers.length === 0 ? (
            <EmptyState
              icon={Plus}
              title="No active members"
              description="Add or import people from the Add people tab."
            />
          ) : (
            <RosterTable
              members={activeMembers}
              sections={sections}
              onUpdate={refetchRoster}
            />
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          {pendingQuery.loading ? (
            <LoadingState label="Loading pending seats…" />
          ) : pendingQuery.error ? (
            <ErrorState
              message={pendingQuery.error}
              onRetry={pendingQuery.refetch}
            />
          ) : (
            <PendingSeats members={pendingMembers} onUpdate={refetchRoster} />
          )}
        </TabsContent>

        <TabsContent value="dropped" className="mt-6">
          {droppedQuery.loading ? (
            <LoadingState label="Loading dropped seats…" />
          ) : droppedQuery.error ? (
            <ErrorState
              message={droppedQuery.error}
              onRetry={droppedQuery.refetch}
            />
          ) : (
            <DroppedSeats members={droppedMembers} onUpdate={refetchRoster} />
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add one person</CardTitle>
                <CardDescription>
                  Add one person without preparing a CSV.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddPersonForm
                  kinds={kinds}
                  sections={sections}
                  seats={{
                    active: members.map((member) => String(member.email)),
                    dropped: droppedMembers.map((member) =>
                      String(member.email),
                    ),
                    pending: pendingMembers.map((member) => ({
                      email: String(member.email),
                      kind: String(member.kind),
                      section:
                        member.section === null ? null : String(member.section),
                    })),
                  }}
                  prefill={prefill}
                  onAdded={refreshRosterAfterAdd}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Import a roster from CSV
                </CardTitle>
                <CardDescription>
                  Add multiple people from a CSV.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CsvImport onComplete={refetchRoster} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

export default function RosterPage() {
  return (
    <RequireCapability capability="course:manage">
      <Suspense fallback={<LoadingState label="Loading roster…" />}>
        <RosterPageContent />
      </Suspense>
    </RequireCapability>
  );
}
