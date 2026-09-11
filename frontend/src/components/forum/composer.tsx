"use client";

import { Bold, Code, Italic, Link2, List, Quote } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MentionAutocomplete } from "@/components/forum/mention-autocomplete";
import { Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { DRAFT_SAVE_DELAY_MS, readDraft, saveDraft } from "@/lib/drafts";
import { cn } from "@/lib/utils";

interface ComposerProps {
  disabled?: boolean;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  minRows?: number;
  autoFocus?: boolean;
  session?: boolean;
  /**
   * Names the slot this composer's writing is kept in until it is posted, so
   * an author who leaves mid-post comes back to it. Cancelling discards it.
   */
  draft?: string;
  onSubmit: (content: string) => Promise<void> | void;
  onCancel?: () => void;
}

type Wrap = { before: string; after?: string; block?: boolean };

const TOOLS: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  wrap: Wrap;
}[] = [
  { icon: Bold, label: "Bold", wrap: { before: "**", after: "**" } },
  { icon: Italic, label: "Italic", wrap: { before: "_", after: "_" } },
  { icon: Link2, label: "Link", wrap: { before: "[", after: "](url)" } },
  { icon: Code, label: "Code", wrap: { before: "`", after: "`" } },
  { icon: Quote, label: "Quote", wrap: { before: "> ", block: true } },
  { icon: List, label: "List", wrap: { before: "- ", block: true } },
];

export function Composer({
  disabled = false,
  initialValue = "",
  placeholder = "Share your thoughts… Markdown supported.",
  submitLabel = "Post",
  minRows = 6,
  autoFocus,
  session,
  draft,
  onSubmit,
  onCancel,
}: ComposerProps) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [kept, setKept] = useState(false);
  const { me } = useAuth();
  const author = draft && me ? String(me.user) : null;
  const ref = useRef<HTMLTextAreaElement>(null);
  const typed = useRef(false);
  const mentionStartRef = useRef<number>(-1);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  // A kept draft returns once the account that wrote it is known, and never
  // over writing already in the box.
  useEffect(() => {
    if (author === null || draft === undefined || typed.current) return;
    const stored = readDraft(author, draft);
    if (stored === null || !stored.body.trim()) return;
    /* eslint-disable react-hooks/set-state-in-effect -- a kept draft returns once its author is known */
    setValue(stored.body);
    setKept(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [author, draft]);

  // Keeping trails typing, so a draft costs one write after a pause rather
  // than one per keystroke.
  useEffect(() => {
    if (author === null || draft === undefined || !typed.current) return;
    const timer = setTimeout(() => {
      saveDraft(author, draft, { body: value });
      setKept(!!value.trim());
    }, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [author, draft, value]);

  // Only the writing in this box is dropped: a page that keeps a title and an
  // audience in the same draft keeps them until it drops its own.
  function discardDraft() {
    if (author !== null && draft !== undefined)
      saveDraft(author, draft, { body: "" });
    setKept(false);
  }

  const detectMention = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart;
    const before = el.value.slice(0, pos);
    const match = before.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
    if (match && match.index !== undefined && match[1].length >= 1) {
      mentionStartRef.current = match.index + match[0].indexOf("@");
      setMentionQuery(match[1]);
    } else {
      mentionStartRef.current = -1;
      setMentionQuery(null);
    }
  }, []);

  function handleSelectMention(username: string) {
    const el = ref.current;
    if (!el || mentionStartRef.current === -1) return;
    const pos = el.selectionStart;
    const before = el.value.slice(0, mentionStartRef.current);
    const after = el.value.slice(pos);
    const next = `${before}@${username} ${after}`;
    typed.current = true;
    setValue(next);
    mentionStartRef.current = -1;
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const caret = before.length + username.length + 2;
      el.setSelectionRange(caret, caret);
    });
  }

  function handleCloseMention() {
    mentionStartRef.current = -1;
    setMentionQuery(null);
    ref.current?.focus();
  }

  function applyWrap(wrap: Wrap) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const before = wrap.before;
    const after = wrap.after ?? "";
    const insert = `${before}${selected}${after}`;
    const next = value.slice(0, start) + insert + value.slice(end);
    typed.current = true;
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + before.length + selected.length;
      el.setSelectionRange(caret, caret);
    });
  }

  async function submit() {
    if (!value.trim() || busy || disabled) return;
    setMentionQuery(null);
    setBusy(true);
    try {
      await onSubmit(value.trim());
      typed.current = false;
      discardDraft();
      setValue("");
    } catch {
      // The submit callback reports the failure; retain the draft for another attempt.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
        {TOOLS.map((tool) => (
          <Button
            key={tool.label}
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            aria-label={tool.label}
            title={tool.label}
            onClick={() => applyWrap(tool.wrap)}
          >
            <tool.icon className="size-4" />
          </Button>
        ))}
        <span className="ml-auto pr-1 text-xs text-muted-foreground">
          ⌘↵ to post
        </span>
      </div>
      <Textarea
        ref={ref}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          typed.current = true;
          setValue(e.target.value);
          requestAnimationFrame(detectMention);
        }}
        onKeyUp={detectMention}
        onSelect={detectMention}
        onClick={detectMention}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (mentionQuery && (e.key === "Enter" || e.key === "Tab")) {
            return;
          }
        }}
        placeholder={placeholder}
        className={cn(
          "resize-y rounded-none border-0 bg-transparent font-mono text-sm leading-6 shadow-none focus-visible:ring-0",
        )}
        style={{ minHeight: `${minRows * 1.5}rem` }}
      />
      {mentionQuery && session ? (
        <div className="relative">
          <MentionAutocomplete
            query={mentionQuery}
            session={session}
            onSelect={handleSelectMention}
            onClose={handleCloseMention}
          />
        </div>
      ) : null}
      <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2.5">
        {kept ? (
          <>
            <span role="status" className="text-xs text-muted-foreground">
              Draft kept in this browser only
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mr-auto text-muted-foreground"
              onClick={() => {
                typed.current = true;
                discardDraft();
                setValue("");
                ref.current?.focus();
              }}
              disabled={busy}
            >
              Discard draft
            </Button>
          </>
        ) : null}
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              typed.current = false;
              discardDraft();
              onCancel();
            }}
            disabled={busy}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={disabled || busy || !value.trim()}
        >
          {busy ? <Spinner className="size-4" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
