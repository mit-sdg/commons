"use client";

import { FileText, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import {
  BODY_MAX,
  isReadableFile,
  titleFromFile,
} from "@/components/live/background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import { api, isApiError, publicErrorMessage, unwrap } from "@/lib/api";

/** Activity references are links to the library; removing one leaves its source intact. */
export function ReferenceDocuments({
  subject,
  retired = false,
  onChanged,
}: {
  subject: string;
  retired?: boolean;
  onChanged?: () => void;
}) {
  const { data, error, refetch } = useQuery(
    () => api["/live/references/get"]({ subject }).then(unwrap),
    [subject],
  );
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    subject: string;
    baseline: typeof data;
    references: string[];
  } | null>(null);
  async function select(references: string[]) {
    setPending({ subject, baseline: data, references });
    setBusy(true);
    try {
      const result = await api["/live/references/select"]({
        subject,
        references,
      });
      if (isApiError(result)) {
        setPending(null);
        toast.error(publicErrorMessage(result.error));
        return;
      }
      refetch();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }
  if (error) return <p className="text-destructive text-sm">{error}</p>;
  return (
    <ReferencePicker
      value={
        pending?.subject === subject && pending.baseline === data
          ? pending.references
          : (data?.references ?? [])
      }
      onChange={(references) => void select(references)}
      disabled={busy || data === null || retired}
    />
  );
}

export function ReferencePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (references: string[]) => void;
  disabled?: boolean;
}) {
  const { data, error, refetch } = useQuery(
    () => api["/live/drafts/documents"]({}).then(unwrap),
    [],
  );
  const [choosing, setChoosing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const documents = data?.documents ?? [];
  const selected = documents.filter((doc) => value.includes(doc.document));
  const out = disabled || saving;
  async function upload() {
    setSaving(true);
    try {
      const result = await api["/live/drafts/give-document"]({ title, body });
      if (isApiError(result)) {
        toast.error(publicErrorMessage(result.error));
        return;
      }
      onChange([...value, result.document]);
      refetch();
      setUploading(false);
      setTitle("");
      setBody("");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">
          Documents{" "}
          <span className="ml-1 text-muted-foreground">({value.length})</span>
        </h2>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={out}
          aria-expanded={choosing}
          onClick={() => setChoosing(!choosing)}
        >
          <Plus /> Add document
        </Button>
      </div>
      {error ? <p className="mt-2 text-destructive text-sm">{error}</p> : null}
      {selected.length ? (
        <ul className="mt-2 divide-y divide-border">
          {selected.map((doc) => (
            <li
              key={doc.document}
              className="flex items-center gap-2 py-2 text-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={doc.title}>
                {doc.title}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={out}
                aria-label={`Remove reference ${doc.title}`}
                onClick={() =>
                  onChange(value.filter((id) => id !== doc.document))
                }
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted-foreground text-xs">
          No reference documents selected.
        </p>
      )}
      {choosing ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Document library</span>
            <Link
              href="/staff/live/background"
              className="text-xs underline underline-offset-4"
            >
              Manage documents
            </Link>
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {documents.map((doc) => (
              <label
                key={doc.document}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={value.includes(doc.document)}
                  disabled={out}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...value, doc.document]
                        : value.filter((id) => id !== doc.document),
                    )
                  }
                />
                <span className="min-w-0 break-words">{doc.title}</span>
              </label>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={out}
            onClick={() => setUploading(!uploading)}
          >
            Upload or paste a document
          </Button>
          {uploading ? (
            <div className="space-y-2 rounded-lg bg-muted/40 p-3">
              <Input
                aria-label="Document title"
                placeholder="Document title"
                maxLength={200}
                value={title}
                disabled={out}
                onChange={(event) => setTitle(event.target.value)}
              />
              <Textarea
                aria-label="Document text"
                placeholder="Paste document text"
                rows={5}
                maxLength={BODY_MAX}
                value={body}
                disabled={out}
                onChange={(event) => setBody(event.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={out}
                  onClick={() => file.current?.click()}
                >
                  Choose .txt or .md file
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={out || !title.trim() || !body.trim()}
                  onClick={() => void upload()}
                >
                  {saving ? "Saving…" : "Save and select"}
                </Button>
              </div>
              <input
                ref={file}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                className="hidden"
                onChange={(event) => {
                  const chosen = event.target.files?.[0];
                  event.target.value = "";
                  if (!chosen) return;
                  if (!isReadableFile(chosen.name, chosen.type)) {
                    toast.error("Choose a .txt or .md file.");
                    return;
                  }
                  void chosen
                    .text()
                    .then((text) => {
                      if (text.length > BODY_MAX) {
                        toast.error(
                          "Document text must be 40,000 characters or fewer.",
                        );
                        return;
                      }
                      setBody(text);
                      setTitle(titleFromFile(chosen.name));
                    })
                    .catch(() => toast.error("Couldn't read this file."));
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
