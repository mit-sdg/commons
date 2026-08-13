"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Composer } from "@/components/forum/composer";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireAuth } from "@/components/require-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, CommonsError, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function NewDiscussionForm() {
  const router = useRouter();
  const { session } = useAuth();
  const [title, setTitle] = useState("");

  async function create(body: string) {
    if (!session) return;
    if (!title.trim()) {
      toast.error("Add a title before posting.");
      return;
    }
    const content = `# ${title.trim()}\n\n${body}`;
    try {
      const { conversation } = unwrap(await api.threads.create({ content }));
      toast.success("Discussion posted.");
      router.push(`/t/${conversation}`);
    } catch (err) {
      toast.error(
        err instanceof CommonsError
          ? err.message
          : publicErrorMessage("INTERNAL_ERROR"),
      );
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

export default function NewDiscussionPage() {
  return (
    <RequireAuth>
      <NewDiscussionForm />
    </RequireAuth>
  );
}
