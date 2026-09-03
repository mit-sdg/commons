"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import {
  copyQuestionnaire,
  copyRounds,
  roundsToCopy,
} from "@/components/live/copy-relay";
import {
  DISCLOSURE_OPTIONS,
  type Disclosure,
  isDisclosure,
  isQuizForm,
} from "@/components/live/quiz-meta";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@/hooks/use-query";
import { api, isApiError, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const KINDS = [
  { kind: "quiz", label: "Quiz" },
  { kind: "survey", label: "Survey" },
  { kind: "relay", label: "Relay" },
] as const;

type Kind = (typeof KINDS)[number]["kind"];

function isKind(value: string | null): value is Kind {
  return KINDS.some((entry) => entry.kind === value);
}

/** Nothing to start from: the value the Select carries for a blank one. */
const BLANK = "blank";

function NewLiveContent() {
  const router = useRouter();
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const asked = searchParams.get("kind");
  const [kind, setKind] = useState<Kind>(isKind(asked) ? asked : "quiz");
  const [title, setTitle] = useState("");
  const [disclosure, setDisclosure] = useState<Disclosure>("score");
  const [source, setSource] = useState(BLANK);
  const [busy, setBusy] = useState(false);

  const { data: shelf } = useQuery(
    session ? () => api["/live/quizzes/list"]({}).then(unwrap) : null,
    [session],
  );
  const { data: relayList } = useQuery(
    session ? () => api["/live/relays/list"]({}).then(unwrap) : null,
    [session],
  );

  const sources =
    kind === "relay"
      ? (relayList?.relays ?? [])
          .filter((entry) => !entry.retired)
          .map((entry) => ({ id: entry.relay, title: entry.title }))
      : (shelf?.questionnaires ?? [])
          .filter((entry) => !entry.retired && entry.form === kind)
          .map((entry) => ({ id: entry.questionnaire, title: entry.title }));

  function chooseKind(value: string) {
    if (!isKind(value)) return;
    setKind(value);
    setSource(BLANK);
  }

  async function createQuestionnaire(trimmed: string) {
    if (!isQuizForm(kind)) return;
    const created = await api["/live/quizzes/create"]({
      title: trimmed,
      form: kind,
      disclosure,
    });
    if (isApiError(created)) {
      setBusy(false);
      toast.error(publicErrorMessage(created.error));
      return;
    }
    if (source !== BLANK) {
      const copied = await copyQuestionnaire(created.questionnaire, source);
      if (isApiError(copied)) {
        setBusy(false);
        toast.error(publicErrorMessage(copied.error));
        return;
      }
    }
    router.push(`/staff/live/${created.questionnaire}/edit`);
  }

  async function createRelay(trimmed: string) {
    const planned = await api["/live/relays/plan"]({ title: trimmed });
    if (isApiError(planned)) {
      setBusy(false);
      toast.error(publicErrorMessage(planned.error));
      return;
    }
    if (source !== BLANK) {
      const read = await api["/live/relays/get"]({ relay: source });
      if (isApiError(read) || read.relay === null) {
        setBusy(false);
        toast.error(
          publicErrorMessage(isApiError(read) ? read.error : "NOT_FOUND"),
        );
        return;
      }
      const copied = await copyRounds(planned.relay, roundsToCopy(read.relay));
      if (isApiError(copied)) {
        setBusy(false);
        toast.error(publicErrorMessage(copied.error));
        return;
      }
    }
    router.push(`/staff/live/relay/${planned.relay}/edit`);
  }

  async function create() {
    const trimmed = title.trim();
    if (trimmed === "") return;
    setBusy(true);
    if (kind === "relay") await createRelay(trimmed);
    else await createQuestionnaire(trimmed);
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        eyebrow={
          <Link
            href="/staff/live"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Live
          </Link>
        }
        title="New"
      />

      <div className="space-y-6">
        <Tabs value={kind} onValueChange={chooseKind}>
          <TabsList>
            {KINDS.map((entry) => (
              <TabsTrigger key={entry.kind} value={entry.kind} disabled={busy}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="live-title">Title</Label>
          <Input
            id="live-title"
            value={title}
            maxLength={200}
            aria-invalid={title.trim() === ""}
            disabled={busy}
            placeholder="e.g. Lecture 7 check-in"
            onChange={(event) => setTitle(event.target.value)}
          />
          {title.trim() === "" ? (
            <p className="text-xs text-destructive">Enter a title.</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="live-source">Start from</Label>
          <Select
            value={source}
            disabled={busy}
            onValueChange={(value) => setSource(value)}
          >
            <SelectTrigger id="live-source" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={BLANK}>Blank</SelectItem>
              {sources.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {kind === "quiz" ? (
          <div className="space-y-2">
            <Label htmlFor="live-disclosure">
              What participants see afterward
            </Label>
            <Select
              value={disclosure}
              disabled={busy}
              onValueChange={(value) => {
                if (isDisclosure(value)) setDisclosure(value);
              }}
            >
              <SelectTrigger id="live-disclosure" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCLOSURE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            disabled={busy || title.trim() === ""}
            onClick={() => void create()}
          >
            {busy ? "Creating…" : "Create"}
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/staff/live">Cancel</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

export default function NewLivePage() {
  return (
    <RequireCapability capability="live:host">
      <Suspense
        fallback={
          <PageContainer width="narrow">
            <LoadingState />
          </PageContainer>
        }
      >
        <NewLiveContent />
      </Suspense>
    </RequireCapability>
  );
}
