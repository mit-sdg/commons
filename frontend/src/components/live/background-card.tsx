"use client";

import { ChevronRight, FileText, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  BODY_MAX,
  type DocumentDraft,
  documentEdit,
  documentTotal,
  isReadableFile,
  nameWanting,
  removeAsked,
  titleFromFile,
} from "@/components/live/background";
import { ActButton } from "@/components/live/round-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import {
  api,
  isApiError,
  type Output,
  publicErrorMessage,
  unwrap,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { count } from "@/lib/format";

type BackgroundDocument = Output<"/live/drafts/documents">["documents"][number];

/** The name a document stands under is as long as any other title here. */
const TITLE_MAX = 200;

const NOTHING: DocumentDraft = { title: "", body: "" };

/** One row of the list: the name, which opens the document it names. */
function DocumentRow({
  title,
  busy,
  onOpen,
}: {
  title: string;
  busy: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-disabled={busy || undefined}
      className="group flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/50"
      onClick={() => {
        if (busy) return;
        onOpen();
      }}
    >
      <FileText className="size-3.5 flex-none text-muted-foreground" />
      <span
        className="min-w-0 truncate underline-offset-4 group-hover:underline"
        dir="auto"
      >
        {title}
      </span>
      <span className="ml-auto flex flex-none items-center gap-1 text-muted-foreground text-xs">
        Open
        <ChevronRight className="size-3.5" />
      </span>
    </button>
  );
}

/** The shared document library, where references are added, revised, and removed. */
export function BackgroundCard() {
  const { session } = useAuth();
  const { data, error, refetch } = useQuery(
    session ? () => api["/live/drafts/documents"]({}).then(unwrap) : null,
    [session],
  );
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<DocumentDraft>(NOTHING);
  // The name the last chosen file filled in, which a hand typing over it keeps.
  const [filled, setFilled] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The document Remove has asked about, until it is removed or kept.
  const [asked, setAsked] = useState<string | null>(null);
  // Ask for a missing name only after Save; choosing a file can supply it.
  const [askedName, setAskedName] = useState(false);
  const chooser = useRef<HTMLInputElement>(null);

  const documents = data?.documents ?? [];
  const standing = documents.find((entry) => entry.document === open) ?? null;

  // A document taken away in another tab takes its open form with it.
  if (open !== null && data !== null && standing === null) {
    setOpen(null);
    setDraft(NOTHING);
    setFilled(null);
    setAsked(null);
    setAskedName(false);
  }

  function close() {
    setOpen(null);
    setAdding(false);
    setDraft(NOTHING);
    setFilled(null);
    setAsked(null);
    setAskedName(false);
  }

  function edit(entry: BackgroundDocument) {
    setOpen(entry.document);
    setAdding(false);
    setDraft({ title: entry.title, body: entry.body });
    setFilled(null);
    setAsked(null);
    setAskedName(false);
  }

  function read(file: File) {
    if (!isReadableFile(file.name, file.type)) {
      toast.error("Choose a .txt or .md file.");
      return;
    }
    void file.text().then(
      (text) => {
        const name = titleFromFile(file.name);
        setDraft((held) => ({
          title:
            held.title.trim() === "" || held.title === filled
              ? name
              : held.title,
          body: text,
        }));
        setFilled(name);
      },
      () => toast.error("That file could not be read."),
    );
  }

  async function save() {
    if (draft.title.trim() === "") {
      setAskedName(true);
      if (draft.body.trim() === "") close();
      return;
    }
    const written =
      standing === null
        ? { title: draft.title.trim(), body: draft.body.trim() }
        : documentEdit(draft, standing);
    if (written === null) {
      close();
      return;
    }
    setBusy(true);
    const result =
      standing === null
        ? await api["/live/drafts/give-document"](written)
        : await api["/live/drafts/revise-document"]({
            document: standing.document,
            ...written,
          });
    setBusy(false);
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    close();
    refetch();
  }

  async function remove() {
    if (standing === null) return;
    setBusy(true);
    const result = await api["/live/drafts/remove-document"]({
      document: standing.document,
    });
    setBusy(false);
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    close();
    refetch();
  }

  const asking = removeAsked(asked, open);
  const total = documentTotal(documents);
  const tooLong = draft.body.trim().length > BODY_MAX;
  const wanting = nameWanting(draft.title, askedName);
  const adds = !adding;

  const form = (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border px-3 py-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="background-name">Name</Label>
        <Input
          id="background-name"
          value={draft.title}
          maxLength={TITLE_MAX}
          readOnly={busy}
          aria-invalid={wanting}
          onChange={(event) =>
            setDraft({ ...draft, title: event.target.value })
          }
        />
        <p aria-live="polite" className="min-h-5 text-destructive text-sm">
          {wanting ? "Give the document a name." : null}
        </p>
      </div>
      <Textarea
        value={draft.body}
        rows={8}
        readOnly={busy}
        aria-label="Document text"
        aria-invalid={tooLong}
        placeholder="Paste text or choose a .txt or .md file"
        onChange={(event) => setDraft({ ...draft, body: event.target.value })}
      />
      {tooLong ? (
        <p className="text-destructive text-sm">
          A document is at most 40,000 characters.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <ActButton
          size="sm"
          out={tooLong}
          busy={busy}
          onClick={() => void save()}
        >
          Save
        </ActButton>
        <ActButton
          variant="outline"
          size="sm"
          busy={busy}
          onClick={() => chooser.current?.click()}
        >
          Choose file
        </ActButton>
        {standing === null ? null : asking ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-sm">
              Delete this document from the library?
            </span>
            <ActButton
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              busy={busy}
              onClick={() => void remove()}
            >
              Delete
            </ActButton>
            <ActButton
              variant="ghost"
              size="sm"
              busy={busy}
              onClick={() => setAsked(null)}
            >
              Cancel
            </ActButton>
          </div>
        ) : (
          <ActButton
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:text-destructive"
            busy={busy}
            onClick={() => setAsked(standing.document)}
          >
            Delete
          </ActButton>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          className={standing === null ? "ml-auto" : undefined}
          onClick={close}
        >
          <X />
        </Button>
      </div>
      <input
        ref={chooser}
        type="file"
        accept=".txt,.md,text/plain,text/markdown"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file !== undefined) read(file);
        }}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4">
      {!adds ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Document library</h2>
          {adds ? (
            <ActButton
              variant="outline"
              size="sm"
              className="shrink-0"
              busy={busy}
              onClick={() => {
                setAdding(true);
                setOpen(null);
                setDraft(NOTHING);
                setFilled(null);
                setAsked(null);
                setAskedName(false);
              }}
            >
              Add document
            </ActButton>
          ) : null}
        </div>
      )}

      {error === null ? null : (
        <p className="text-destructive text-sm">{error}</p>
      )}

      {data === null ? null : (
        <p className="text-muted-foreground text-sm">
          {documents.length === 0
            ? "No documents yet."
            : `${count(documents.length, "document")}, ${total.toLocaleString()} ${
                total === 1 ? "character" : "characters"
              }`}
        </p>
      )}

      <div className="flex flex-col gap-1">
        {documents.map((entry) =>
          open === entry.document ? (
            <div key={entry.document}>{form}</div>
          ) : (
            <div key={entry.document} className="flex flex-col gap-1.5">
              <DocumentRow
                title={entry.title}
                busy={busy}
                onOpen={() => edit(entry)}
              />
            </div>
          ),
        )}
        {adding ? form : null}
      </div>
    </div>
  );
}
