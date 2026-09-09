"use client";

import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";

export interface PickedMember {
  user: string;
  displayName: string;
}

/** Search keeps the existing course directory and exact-username lookup rules. */
export function MemberPicker({
  chosen,
  fixed,
  excluded = [],
  onChange,
  label = "Members",
  disabled = false,
}: {
  chosen: PickedMember[];
  fixed?: string;
  excluded?: string[];
  onChange: (next: PickedMember[]) => void;
  label?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const available = results.filter(
    (member) =>
      member.user !== fixed &&
      !excluded.includes(member.user) &&
      !chosen.some((entry) => entry.user === member.user),
  );

  useEffect(() => {
    const term = query.trim();
    if (!open || !term) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const found = await api.users.search({ query: term });
        let people: PickedMember[] = [];
        if (!("error" in found) && found.users.length) {
          people = found.users.map((row) => ({
            user: String(row.user),
            displayName: row.profile.displayName || String(row.username),
          }));
        } else if (!("error" in found)) {
          const resolved = await api.users.resolve({ ref: term });
          if (!("error" in resolved) && resolved.user)
            people = [
              {
                user: String(resolved.user),
                displayName: String(resolved.username),
              },
            ];
        } else {
          throw new Error("Search unavailable");
        }
        if (cancelled) return;
        setResults(people);
        setNotice(people.length ? null : `No people match “${term}”.`);
      } catch {
        if (!cancelled) setNotice("Couldn’t search people. Try typing again.");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  function changeQuery(value: string) {
    setQuery(value);
    setResults([]);
    setSearching(Boolean(value.trim()));
    setNotice(null);
    setActive(0);
  }
  function add(member: PickedMember) {
    onChange([...chosen, member]);
    changeQuery("");
  }
  function move(next: number) {
    const index = (next + available.length) % available.length;
    setActive(index);
    list.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {chosen.map((member) => (
          <span
            key={member.user}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
          >
            <span className="break-words">{member.displayName}</span>
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
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          changeQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            aria-label="Add people…"
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-between font-normal text-muted-foreground"
          >
            Add people…
            <ChevronDown className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-0 p-2"
        >
          <Input
            role="combobox"
            aria-label="Search people"
            aria-expanded={open}
            aria-controls={`${id}-results`}
            aria-autocomplete="list"
            aria-activedescendant={
              available[active] ? `${id}-option-${active}` : undefined
            }
            value={query}
            placeholder="Search by name or username"
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={(event) => {
              if (
                (event.key === "ArrowDown" || event.key === "ArrowUp") &&
                available.length
              ) {
                event.preventDefault();
                move(active + (event.key === "ArrowDown" ? 1 : -1));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (available[active]) add(available[active]);
              }
            }}
          />
          <div
            role="status"
            className="px-2 py-2 text-xs text-muted-foreground"
          >
            {searching ? (
              <span className="flex items-center gap-2">
                <Spinner className="size-3" />
                Searching…
              </span>
            ) : (
              notice ||
              (!query.trim()
                ? "Type a name to find people."
                : !available.length
                  ? "These people are already members."
                  : `${available.length} ${available.length === 1 ? "person" : "people"} found`)
            )}
          </div>
          <div
            id={`${id}-results`}
            role="listbox"
            aria-label="People"
            ref={list}
            className="max-h-56 overflow-y-auto"
          >
            {available.map((member, index) => (
              <div
                key={member.user}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => add(member)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm ${index === active ? "bg-accent" : ""}`}
              >
                <span>{member.displayName}</span>
                {index === active ? (
                  <Check className="size-4 shrink-0" />
                ) : null}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
