"use client";

import { UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export interface PickedMember {
  user: string;
  displayName: string;
}

/**
 * Chooses the profiles a task list is for. Search covers course members; an
 * exact username always resolves, so a list can include anyone with an account.
 */
export function MemberPicker({
  chosen,
  fixed,
  onChange,
  label = "Members",
  disabled = false,
}: {
  chosen: PickedMember[];
  fixed?: string;
  onChange: (next: PickedMember[]) => void;
  label?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const add = (member: PickedMember) => {
    if (chosen.some((entry) => entry.user === member.user)) return;
    onChange([...chosen, member]);
    setResults([]);
    setQuery("");
    setNotice(null);
  };

  async function search() {
    const term = query.trim();
    if (term === "") return;
    setSearching(true);
    setNotice(null);
    const found = await api.users.search({ query: term });
    if (!("error" in found) && found.users.length > 0) {
      setResults(
        found.users.map((row) => ({
          user: String(row.user),
          displayName: row.profile.displayName || String(row.username),
        })),
      );
      setSearching(false);
      return;
    }
    const resolved = await api.users.resolve({ ref: term });
    setSearching(false);
    if ("error" in resolved || !resolved.user) {
      setResults([]);
      setNotice(`No profile matches “${term}”.`);
      return;
    }
    setResults([
      { user: String(resolved.user), displayName: String(resolved.username) },
    ]);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="task-member-search">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {chosen.map((member) => (
          <span
            key={member.user}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
          >
            {member.displayName}
            {member.user === fixed ? (
              <span className="text-muted-foreground">(you)</span>
            ) : (
              <button
                type="button"
                aria-label={`Remove ${member.displayName}`}
                disabled={disabled}
                onClick={() =>
                  onChange(chosen.filter((entry) => entry.user !== member.user))
                }
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          id="task-member-search"
          value={query}
          disabled={disabled}
          placeholder="Search by name or username"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void search();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || searching || query.trim() === ""}
          onClick={() => void search()}
        >
          {searching ? <Spinner className="size-4" /> : "Find"}
        </Button>
      </div>
      {notice ? (
        <p className="text-xs text-muted-foreground">{notice}</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {results.map((member) => (
            <li key={member.user}>
              <button
                type="button"
                onClick={() => add(member)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <UserPlus className="size-4 text-muted-foreground" />
                {member.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
