"use client";

import { Pencil, Plus, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CsvImport } from "@/components/lms/csv-import";
import { RosterTable } from "@/components/lms/roster-table";
import { PageContainer, PageHeader } from "@/components/page";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@/hooks/use-query";
import type { Output } from "@/lib/api";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  loadClassConfiguration,
  loadDroppedRoster,
  loadPendingRoster,
  loadRosterList,
  loadSections,
} from "@/lib/lms";

function ClassConfig({
  configuration,
  onConfigured,
}: {
  configuration: {
    code: string;
    title: string;
    term: string;
    timezone: string;
    status: string;
  } | null;
  onConfigured: () => void;
}) {
  const { session } = useAuth();
  const [code, setCode] = useState(configuration?.code ?? "");
  const [title, setTitle] = useState(configuration?.title ?? "");
  const [term, setTerm] = useState(configuration?.term ?? "");
  const [timezone, setTimezone] = useState(
    configuration?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [loading, setLoading] = useState(false);

  async function configure() {
    if (!session) return;
    setLoading(true);
    const result = await api.roster["configure-class"]({
      code,
      title,
      term,
      timezone,
    });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Course configured");
      onConfigured();
    }
  }

  if (configuration) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="size-4" /> Course configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Course code</dt>
              <dd className="font-medium">{configuration.code}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Title</dt>
              <dd className="font-medium">{configuration.title}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Term</dt>
              <dd className="font-medium">{configuration.term}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Timezone</dt>
              <dd className="font-medium">{configuration.timezone}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Course identity is fixed after initial configuration.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="size-4" /> Configure course
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cc-code">Course Code</Label>
            <Input
              id="cc-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CS101"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-title">Title</Label>
            <Input
              id="cc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Intro to CS"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-term">Term</Label>
            <Input
              id="cc-term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Fall 2026"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-tz">Timezone</Label>
            <Input
              id="cc-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/New_York"
            />
          </div>
        </div>
        <Button
          onClick={configure}
          disabled={loading || !code || !title || !term}
        >
          Configure Class
        </Button>
      </CardContent>
    </Card>
  );
}

function SectionManager() {
  const { session } = useAuth();
  const { data, refetch } = useQuery<{
    sections: {
      section: string;
      name: string;
      location?: string;
      meetingPattern?: string;
      status: string;
    }[];
  }>(() => loadSections(), []);

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
      refetch();
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
      refetch();
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
    const result = await api.roster["link-user"]({
      seat: linking,
      user: String(resolved.user),
    });
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(`Linked @${resolved.username}`);
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
            <div>
              <p className="font-medium">{member.rosterName}</p>
              <p className="text-sm text-muted-foreground">{member.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {member.kind.toLowerCase()} · Key {member.externalKey}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setLinking(String(member.seat));
                setAccount("");
              }}
            >
              Link account
            </Button>
          </div>
          {linking === String(member.seat) ? (
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
                  {busy ? "Linking…" : "Link"}
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
            <p className="font-medium">{member.rosterName}</p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {member.kind.toLowerCase()}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => reinstate(String(member.seat))}
            disabled={busy === String(member.seat)}
          >
            {busy === String(member.seat) ? "Reinstating…" : "Reinstate"}
          </Button>
        </div>
      ))}
    </div>
  );
}

export default function RosterPage() {
  const { session } = useAuth();
  const {
    data: rosterData,
    loading,
    error,
    refetch,
  } = useQuery(session ? () => loadRosterList() : null, [session]);

  const classQuery = useQuery(session ? () => loadClassConfiguration() : null, [
    session,
  ]);
  const pendingQuery = useQuery(session ? () => loadPendingRoster() : null, [
    session,
  ]);
  const droppedQuery = useQuery(session ? () => loadDroppedRoster() : null, [
    session,
  ]);

  const { data: sectionsData } = useQuery<{
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
  const sections = sectionsData?.sections ?? [];

  function refetchRoster() {
    refetch();
    pendingQuery.refetch();
    droppedQuery.refetch();
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Staff"
        title="Roster management"
        description="Configure the course, manage sections, and maintain member access."
      />

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="active">
            Active ({activeMembers.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pendingQuery.data?.members.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="dropped">
            Dropped ({droppedQuery.data?.members.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="import">CSV import</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-6 space-y-6">
          {classQuery.loading ? (
            <LoadingState label="Loading course configuration…" />
          ) : (
            <ClassConfig
              configuration={classQuery.data?.class ?? null}
              onConfigured={classQuery.refetch}
            />
          )}
          <SectionManager />
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
              description="Import seats, then let members claim them or link an account."
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
            <PendingSeats
              members={pendingQuery.data?.members ?? []}
              onUpdate={refetchRoster}
            />
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
            <DroppedSeats
              members={droppedQuery.data?.members ?? []}
              onUpdate={refetchRoster}
            />
          )}
        </TabsContent>

        <TabsContent value="import" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Import Roster from CSV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CsvImport onComplete={refetchRoster} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
