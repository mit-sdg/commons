"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

function NewDiscussionForm({ initialAudience }: { initialAudience: string }) {
  const router = useRouter();
  const [posting, setPosting] = useState(false);
  const { session } = useAuth();
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<string[]>([initialAudience]);
  const options = useQuery(
    async () => unwrap(await api.audiences.options({})),
    [],
  );
  const preview = useQuery(
    async () => unwrap(await api.audiences.preview({ holders: selected })),
    [selected],
  );

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
    if (!session || !preview.data) throw new Error("Choose a valid audience.");
    if (!title.trim()) {
      toast.error("Add a title before posting.");
      throw new Error("A title is required.");
    }
    const content = `# ${title.trim()}\n\n${body}`;
    setPosting(true);
    try {
      const { conversation } = unwrap(
        await api.threads.create({ content, holders: preview.data.holders }),
      );
      toast.success("Discussion posted.");
      router.push(`/t/${conversation}`);
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
        eyebrow="Discussions"
        title="Start a discussion"
        description="Give your discussion a clear title, then write an opening post in Markdown."
      />
      <div className="space-y-5">
        <AudiencePicker
          selected={selected}
          options={options.data?.holders ?? []}
          disabled={options.loading || posting}
          onChange={setSelected}
          onRefresh={() => {
            refreshOptions();
            refreshPreview();
          }}
        />
        {preview.data ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Final audience</p>
            <p className="text-xs text-muted-foreground">
              These people and audiences stay fixed after posting. Group and
              section access follows current membership.
            </p>
            <AudienceChips
              holders={preview.data.holders}
              options={options.data?.holders ?? []}
            />
          </div>
        ) : (
          <p role="status">{preview.error ?? "Checking audience…"}</p>
        )}

        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
            minRows={10}
            placeholder="Lay out your question or idea. You can mention a post with [[post-id]]."
            onSubmit={create}
          />
        </div>
      </div>
    </PageContainer>
  );
}

export function NewDiscussion({
  initialAudience,
}: {
  initialAudience: string;
}) {
  return (
    <RequireAuth>
      <NewDiscussionForm
        key={initialAudience}
        initialAudience={initialAudience}
      />
    </RequireAuth>
  );
}
