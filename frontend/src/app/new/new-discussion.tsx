"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AudienceChips,
  AudiencePicker,
} from "@/components/forum/audience-picker";
import { Composer } from "@/components/forum/composer";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireAuth } from "@/components/require-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@/hooks/use-query";
import { api, CommonsError, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  clearDraft,
  DRAFT_SAVE_DELAY_MS,
  newDiscussionScope,
  readDraft,
  saveDraft,
} from "@/lib/drafts";

function NewDiscussionForm({
  initialAudience,
  fromGroup,
}: {
  initialAudience: string;
  fromGroup?: string;
}) {
  const router = useRouter();
  const [posting, setPosting] = useState(false);
  const { session, me } = useAuth();
  const [title, setTitle] = useState("");
  const [chosen, setSelected] = useState<string[]>([initialAudience]);
  const selected = fromGroup ? [`group:${fromGroup}`] : chosen;
  const author = me ? String(me.user) : null;
  // The composer keeps the opening post; this page keeps the title and the
  // audience beside it, so one unfinished discussion resumes whole.
  const scope = newDiscussionScope(
    fromGroup ? `group:${fromGroup}` : initialAudience,
  );
  const [resumed, setResumed] = useState(false);
  const touched = useRef(false);
  const posted = useRef(false);
  const keptOnce = useRef(false);
  const options = useQuery(
    async () => unwrap(await api.audiences.options({})),
    [],
  );
  const preview = useQuery(
    selected.length
      ? async () => unwrap(await api.audiences.preview({ holders: selected }))
      : null,
    [selected.join("\u0000")],
  );

  // An unfinished discussion returns once its author and the audiences they
  // may still address are known: an audience since lost is dropped rather than
  // refused at post time. Writing already entered here is never overwritten.
  const audiences = options.data?.holders;
  const audiencesRefused = options.error;
  useEffect(() => {
    if (resumed || author === null) return;
    if (!audiences && !audiencesRefused) return;
    /* eslint-disable react-hooks/set-state-in-effect -- an unfinished discussion returns once its author is known */
    setResumed(true);
    if (touched.current) return;
    const kept = readDraft(author, scope);
    if (kept === null) return;
    if (kept.title) setTitle(kept.title);
    if (!fromGroup && kept.holders.length) {
      const offered = audiences
        ? new Set(audiences.map((holder) => holder.holder))
        : null;
      const usable = offered
        ? kept.holders.filter((holder) => offered.has(holder))
        : kept.holders;
      if (usable.length) setSelected(usable);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [audiences, audiencesRefused, author, fromGroup, resumed, scope]);

  // Nothing is kept until the resume above has read what was there, or the
  // read would find what this just wrote. Whatever was typed while the
  // audiences loaded is kept the moment resuming ends; later edits trail
  // typing, so a draft costs one write after a pause rather than one per
  // keystroke.
  const audience = selected.join("\u0000");
  useEffect(() => {
    if (author === null || !resumed) return;
    function keep() {
      if (posted.current || author === null) return;
      saveDraft(author, scope, {
        title,
        holders: audience ? audience.split("\u0000") : [],
      });
    }
    if (!keptOnce.current) {
      keptOnce.current = true;
      keep();
      return;
    }
    const timer = setTimeout(keep, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [audience, author, resumed, scope, title]);

  const refreshOptions = options.refetch;
  const refreshPreview = preview.refetch;
  useEffect(() => {
    function refreshAudience() {
      refreshOptions();
      refreshPreview();
    }
    window.addEventListener("focus", refreshAudience);
    return () => window.removeEventListener("focus", refreshAudience);
  }, [refreshOptions, refreshPreview]);

  async function create(body: string) {
    if (!session || !preview.data || !selected.length)
      throw new Error("Choose who can see this.");
    if (!title.trim()) {
      toast.error("Add a title before posting.");
      throw new Error("A title is required.");
    }
    const content = `# ${title.trim()}\n\n${body}`;
    setPosting(true);
    try {
      const { conversation } = unwrap(
        await api.threads.create({
          content,
          holders: unwrap(await api.audiences.preview({ holders: selected }))
            .holders,
        }),
      );
      posted.current = true;
      if (author !== null) clearDraft(author, scope);
      toast.success("Discussion posted.");
      router.push(
        `/t/${conversation}${fromGroup ? `?fromGroup=${encodeURIComponent(fromGroup)}` : ""}`,
      );
    } catch (err) {
      toast.error(
        err instanceof CommonsError
          ? err.message
          : publicErrorMessage("INTERNAL_ERROR"),
      );
      throw err;
    } finally {
      setPosting(false);
    }
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={
          fromGroup
            ? `New discussion in ${options.data?.holders.find((holder) => holder.holder === `group:${fromGroup}`)?.label ?? "this group"}`
            : "New discussion"
        }
      />
      <div className="space-y-5">
        <div className="space-y-2">
          {!fromGroup ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Who can see this?
              </span>
              <AudiencePicker
                selected={selected}
                options={options.data?.holders ?? []}
                disabled={posting}
                loading={options.loading}
                error={options.error}
                onChange={(holders) => {
                  touched.current = true;
                  setSelected(holders);
                }}
                onRefresh={() => {
                  refreshOptions();
                  refreshPreview();
                }}
              />
            </div>
          ) : null}
          {!selected.length ? (
            <p role="status" className="text-sm text-muted-foreground">
              Choose who can see this.
            </p>
          ) : preview.error ? (
            <p role="alert" className="text-sm text-destructive">
              {preview.refused === "FORBIDDEN"
                ? fromGroup
                  ? "This group is unavailable or you no longer have access to it."
                  : "A selected recipient is no longer available. Update your selection."
                : "Couldn’t check recipients."}{" "}
              <button
                type="button"
                className="underline"
                onClick={refreshPreview}
              >
                Retry
              </button>
            </p>
          ) : preview.data ? (
            <AudienceChips
              holders={preview.data.holders}
              options={options.data?.holders ?? []}
            />
          ) : (
            <p role="status" className="text-xs text-muted-foreground">
              Checking recipients…
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => {
              touched.current = true;
              setTitle(e.target.value);
            }}
            placeholder="What would you like to discuss?"
            className="text-base"
            autoFocus
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Opening post</Label>
          <Composer
            disabled={
              posting || !preview.data || preview.loading || !title.trim()
            }
            session={session ?? undefined}
            submitLabel="Post discussion"
            minRows={6}
            placeholder="Write your question or idea…"
            draft={scope}
            onSubmit={create}
          />
        </div>
      </div>
    </PageContainer>
  );
}

export function NewDiscussion({
  initialAudience,
  fromGroup,
}: {
  initialAudience: string;
  fromGroup?: string;
}) {
  return (
    <RequireAuth>
      <NewDiscussionForm
        key={initialAudience}
        initialAudience={initialAudience}
        fromGroup={fromGroup}
      />
    </RequireAuth>
  );
}
