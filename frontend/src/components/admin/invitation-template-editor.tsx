"use client";

import { Eye, RotateCcw, Undo2 } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { ErrorState, LoadingState, Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import { api, requestErrorMessage, unwrap, withRequestErrors } from "@/lib/api";
import {
  BODY_LIMIT,
  type InvitationDraft,
  type InvitationPreview,
  initialTemplateState,
  performTemplateOperation,
  SUBJECT_LIMIT,
  sameTemplate,
  type TemplateAnswer,
  type TemplateOperation,
  templateEditorReducer,
  templateInputErrors,
} from "@/lib/mail-ui";
import { cn } from "@/lib/utils";
import { MailTextPreview } from "./mail-text-preview";

/** How long typing settles before the draft is rendered again. */
const PREVIEW_DELAY = 450;

/**
 * The preview follows the draft on its own: a preview renders rather than
 * decides, so there is nothing for a reader to press. The last good render
 * stays on screen while the next one is in flight, and an invalid draft is
 * not sent at all — its inline error already says what is wrong.
 */
function useLivePreview(draft: InvitationDraft, invalid: boolean) {
  const [shown, setShown] = useState<{
    preview: InvitationPreview | null;
    of: InvitationDraft;
    error: string | null;
  } | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    if (invalid) return;
    const timer = setTimeout(() => {
      const id = ++latest.current;
      withRequestErrors(() => api.mail["preview-template"](draft))
        .then((answer) => {
          if (id !== latest.current) return;
          setShown({ preview: unwrap(answer).preview, of: draft, error: null });
        })
        .catch((cause: unknown) => {
          if (id !== latest.current) return;
          // The last good render stays; only the notice beside it changes.
          setShown((previous) => ({
            preview: previous?.preview ?? null,
            of: draft,
            error: requestErrorMessage(cause),
          }));
        });
    }, PREVIEW_DELAY);
    return () => {
      clearTimeout(timer);
      latest.current += 1;
    };
  }, [draft, invalid]);

  return {
    preview: shown?.preview ?? null,
    error: shown?.error ?? null,
    /** Derived, so no render is scheduled from inside the effect. */
    rendering: !invalid && (!shown || !sameTemplate(shown.of, draft)),
  };
}

/** A live count that turns to a warning as the limit comes into view. */
function Counter({
  length,
  limit,
  children,
}: {
  length: number;
  limit: number;
  children?: React.ReactNode;
}) {
  const near = length > limit * 0.9;
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5">
      <span
        className={cn(
          "tabular-nums",
          near && "font-medium text-amber-600 dark:text-amber-400",
          length > limit && "font-medium text-destructive",
        )}
      >
        {length.toLocaleString()} / {limit.toLocaleString()}
      </span>
      {children}
    </span>
  );
}

export function InvitationTemplateForm({ answer }: { answer: TemplateAnswer }) {
  const [state, dispatch] = useReducer(
    templateEditorReducer,
    answer,
    initialTemplateState,
  );
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const dirty = !sameTemplate(state.saved, state.draft);
  const errors = templateInputErrors(state.draft);
  const invalid = Boolean(errors.subject || errors.body);
  const busy = state.pending !== null;
  const live = useLivePreview(state.draft, invalid);

  useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function run(operation: TemplateOperation) {
    if (inFlight.current || (operation === "save" && invalid)) return;
    inFlight.current = true;
    const id = ++requestId.current;
    dispatch({ type: "start", operation });
    try {
      const outcome = await performTemplateOperation(
        api.mail,
        operation,
        state.draft,
      );
      if (requestId.current === id) dispatch(outcome);
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <form
      className="mt-5 grid gap-6 lg:grid-cols-2 lg:gap-8"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty) void run("save");
      }}
    >
      <div className="min-w-0 space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <legend className="sr-only">Invitation wording</legend>
          <div className="space-y-1.5">
            <Label htmlFor="invitation-subject">Subject</Label>
            <Input
              id="invitation-subject"
              value={state.draft.subject}
              maxLength={SUBJECT_LIMIT}
              required
              aria-invalid={Boolean(errors.subject)}
              aria-describedby="invitation-subject-hint"
              onChange={(event) =>
                dispatch({
                  type: "edit",
                  draft: { ...state.draft, subject: event.target.value },
                })
              }
            />
            <p
              id="invitation-subject-hint"
              className={cn(
                "text-xs",
                errors.subject ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {errors.subject ?? (
                <Counter
                  length={state.draft.subject.length}
                  limit={SUBJECT_LIMIT}
                >
                  characters, one line.
                </Counter>
              )}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invitation-body">Body</Label>
            <Textarea
              id="invitation-body"
              className="min-h-48 field-sizing-fixed leading-6 sm:min-h-64"
              value={state.draft.body}
              maxLength={BODY_LIMIT}
              required
              aria-invalid={Boolean(errors.body)}
              aria-describedby="invitation-body-hint"
              onChange={(event) =>
                dispatch({
                  type: "edit",
                  draft: { ...state.draft, body: event.target.value },
                })
              }
            />
            <p
              id="invitation-body-hint"
              className={cn(
                "text-xs",
                errors.body ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {errors.body ?? (
                <Counter length={state.draft.body.length} limit={BODY_LIMIT}>
                  characters. Plain text: Markdown, HTML and placeholders are
                  not interpreted.
                </Counter>
              )}
            </p>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={busy || invalid || !dirty}>
            {state.pending === "save" ? "Saving…" : "Save wording"}
          </Button>
          {dirty ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => dispatch({ type: "discard" })}
            >
              <Undo2 className="size-3.5" />
              Discard changes
            </Button>
          ) : null}
          <ConfirmAction
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy || !state.worded}
              >
                <RotateCcw className="size-3.5" />
                {state.pending === "reset"
                  ? "Restoring…"
                  : "Use Commons' wording"}
              </Button>
            }
            title="Restore Commons' own wording?"
            description="Your saved invitation wording is withdrawn and any unsaved changes are discarded. Email already queued is unchanged."
            confirmLabel="Restore wording"
            onConfirm={() => run("reset")}
          />
        </div>

        <p
          role="status"
          className={cn(
            "text-sm",
            state.notice
              ? "font-medium text-foreground"
              : "text-muted-foreground",
          )}
        >
          {state.notice ??
            (dirty
              ? "Unsaved changes"
              : state.worded
                ? "Your wording is saved and in use."
                : "Commons' own wording is in use.")}
        </p>
        {state.error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}
      </div>

      <section
        aria-label="Invitation preview"
        className="min-w-0 lg:sticky lg:top-6 lg:self-start"
      >
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold">
            <Eye aria-hidden="true" className="size-4 text-muted-foreground" />
            Live preview
          </h4>
          <span
            aria-live="polite"
            className={cn(
              "flex items-center gap-1 text-xs",
              invalid ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {invalid ? (
              "Paused — fix the wording above."
            ) : live.rendering ? (
              <>
                <Spinner className="size-3" />
                Updating…
              </>
            ) : null}
          </span>
        </div>
        {live.error ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            The preview could not be refreshed. {live.error}
          </p>
        ) : null}
        {live.preview ? (
          <div
            className={cn(
              "transition-opacity",
              (invalid || live.rendering) && "opacity-60",
            )}
          >
            <MailTextPreview
              subject={live.preview.subject}
              recipient="student@example.edu"
              text={live.preview.text}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            {invalid ? "Fix the wording to see the preview." : "Rendering…"}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Sample recipient and password. Nothing is queued or sent by a preview.
        </p>
      </section>
    </form>
  );
}

export function InvitationTemplateEditor() {
  const query = useQuery<TemplateAnswer>(
    () => withRequestErrors(() => api.mail.template({})),
    [],
  );
  return (
    <section
      aria-labelledby="invitation-template-heading"
      className="rounded-xl border border-border bg-card p-4 sm:p-5 lg:p-6"
    >
      <h3
        id="invitation-template-heading"
        className="font-display text-lg font-semibold"
      >
        Invitation email
      </h3>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Word the invitation Commons sends. Changes apply to future invitations
        and resends, never to email already queued. The registration link,
        temporary password and lifetime note are always appended for you.
      </p>
      {query.loading && !query.data ? (
        <LoadingState label="Loading invitation wording…" />
      ) : query.error ? (
        <div className="mt-4">
          <ErrorState message={query.error} onRetry={query.refetch} />
        </div>
      ) : query.data ? (
        <InvitationTemplateForm answer={query.data} />
      ) : null}
    </section>
  );
}
