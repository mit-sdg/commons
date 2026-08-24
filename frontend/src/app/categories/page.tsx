"use client";

import { FolderOpen, FolderPlus, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { CategoryDot } from "@/components/forum/badges";
import { Link } from "@/components/link";
import { PageContainer, PageHeader } from "@/components/page";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Category } from "@/lib/models";

export default function CategoriesPage() {
  const { session, permissions } = useAuth();
  const { data, error, loading, refetch } = useQuery<{
    categories: Category[];
  }>(() => api.categories.list({}), []);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Creation and deletion are the same power: `administer` is what the
  // endpoints behind both controls enforce.
  const canAdminister = permissions.can("administer");

  async function create() {
    if (!session || !name.trim()) return;
    setCreating(true);
    const result = await api.categories.create({
      name: name.trim(),
      description: description.trim(),
    });
    setCreating(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Category created");
      setName("");
      setDescription("");
      refetch();
    }
  }

  async function remove(category: string) {
    if (!session) return;
    const result = await api.categories.delete({ category });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Category deleted");
      refetch();
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Browse"
        title="Categories"
        description="Topics grouped by the spaces they belong to."
      />

      {canAdminister ? (
        <section className="mb-6 rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <FolderPlus className="size-5" />
            New category
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Announcements"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Input
                id="cat-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What belongs here?"
              />
            </div>
          </div>
          <Button
            className="mt-4"
            onClick={create}
            disabled={creating || !name.trim()}
          >
            {creating ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
            Create category
          </Button>
        </section>
      ) : null}

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !data || data.categories.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No categories yet"
          description="Categories will appear here once they are created."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.categories.map((category) => (
            <div
              key={String(category.category)}
              className="group relative rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
            >
              <Link href={`/c/${category.category}`} className="block">
                <div className="mb-2 flex items-center gap-2.5 pr-10">
                  <CategoryDot
                    id={String(category.category)}
                    className="size-3.5"
                  />
                  <h2 className="font-display text-xl font-semibold group-hover:text-primary">
                    {category.name}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {category.description || "No description provided."}
                </p>
              </Link>
              {canAdminister ? (
                <ConfirmAction
                  title={`Delete ${category.name}?`}
                  description="This removes the category. Discussions and posts are not deleted."
                  confirmLabel="Delete category"
                  destructive
                  onConfirm={() => remove(String(category.category))}
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-3 top-3 size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
