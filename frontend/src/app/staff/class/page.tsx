"use client";

import { Loader2, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@/hooks/use-query";
import type { Output } from "@/lib/api";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadClassConfiguration } from "@/lib/lms";
import { classSettingsRefusal } from "@/lib/roster-messages";

type ClassSettings = NonNullable<Output<"/roster/class">["class"]>;

/**
 * Setting the class up and correcting it later are two acts behind the same
 * form: whichever one applies is chosen from what the deployment already has,
 * so the person filling this in only ever sees "the class".
 */
function ClassSettingsForm({
  configuration,
  onSaved,
}: {
  configuration: ClassSettings | null;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const [code, setCode] = useState(configuration?.code ?? "");
  const [title, setTitle] = useState(configuration?.title ?? "");
  const [term, setTerm] = useState(configuration?.term ?? "");
  const [timezone, setTimezone] = useState(
    configuration?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const configured = configuration !== null;
  const complete = Boolean(
    code.trim() && title.trim() && term.trim() && timezone.trim(),
  );

  async function save() {
    if (!session || !complete) return;
    setSaving(true);
    setConflict(null);
    const fields = {
      code: code.trim(),
      title: title.trim(),
      term: term.trim(),
      timezone: timezone.trim(),
    };
    const result = configured
      ? await api.roster["update-class"](fields)
      : await api.roster["configure-class"](fields);
    setSaving(false);

    if ("error" in result) {
      const message = classSettingsRefusal(result.error, configured);
      toast.error(message);
      // A conflict means the class stopped matching what this form was built
      // for, so keep the sentence on screen and reload what the deployment
      // actually has.
      if (result.error === "CONFLICT") {
        setConflict(message);
        onSaved();
      }
      return;
    }

    toast.success(configured ? "Class settings saved" : "Class configured");
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="size-4" />
          {configured ? "Class details" : "Set up the class"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {configured
            ? "These details name the class across the course pages. Revise them whenever the code, title, term, or timezone changes."
            : "This deployment does not have a class yet. Fill these in once and every course page will use them; you can revise them later."}
        </p>

        {conflict ? (
          <p
            role="status"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {conflict}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="class-code">Class code</Label>
            <Input
              id="class-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="CS101"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-title">Title</Label>
            <Input
              id="class-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Intro to CS"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-term">Term</Label>
            <Input
              id="class-term"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Fall 2026"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-timezone">Timezone</Label>
            <Input
              id="class-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="America/New_York"
            />
            <p className="text-xs text-muted-foreground">
              Due dates and the calendar are read in this timezone.
            </p>
          </div>
        </div>

        <Button onClick={save} disabled={saving || !complete}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {configured ? "Save class settings" : "Configure class"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ClassSettingsPageContent() {
  const { session } = useAuth();
  const { data, loading, error, refetch } = useQuery(
    session ? () => loadClassConfiguration() : null,
    [session],
  );

  const configuration = data?.class ?? null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Staff"
        title="Class settings"
        description="The class this deployment runs: its code, title, term, and timezone."
      />

      {loading && !data ? (
        <LoadingState label="Loading class settings…" />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <ClassSettingsForm
          key={configuration ? "configured" : "unconfigured"}
          configuration={configuration}
          onSaved={refetch}
        />
      )}
    </PageContainer>
  );
}

export default function ClassSettingsPage() {
  return (
    <RequireCapability capability="course:manage">
      <ClassSettingsPageContent />
    </RequireCapability>
  );
}
