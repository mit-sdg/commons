"use client";

import { useState } from "react";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Output } from "@/lib/api";

export type AudienceOption = Output<"/audiences/options">["holders"][number];

export function audiencePresentation(
  option: AudienceOption,
  options: AudienceOption[],
) {
  const kind =
    option.kind === "account"
      ? "Person"
      : option.kind === "group"
        ? "Group"
        : option.kind === "section"
          ? "Section"
          : "Course audience";
  const label = option.label;
  const collisions = options.filter(
    (other) => other.kind === option.kind && other.label === option.label,
  );
  let suffix = "";
  if (collisions.length > 1) {
    let length = 6;
    while (
      length < option.identity.length &&
      collisions.some(
        (other) =>
          other.holder !== option.holder &&
          other.identity.slice(0, length) === option.identity.slice(0, length),
      )
    )
      length++;
    suffix = ` · ${option.identity.slice(0, length)}`;
  }
  return { label: `${label}${suffix}`, kind };
}

export function AudienceChips({
  holders,
  options,
}: {
  holders: string[];
  options: AudienceOption[];
}) {
  return (
    <ul aria-label="Audience" className="flex flex-wrap gap-2">
      {holders.map((holder) => {
        const option = options.find((option) => option.holder === holder);
        const displayed = option
          ? audiencePresentation(option, options)
          : {
              label: "Selected audience",
              kind: holder.startsWith("account:")
                ? "Person"
                : holder.startsWith("group:")
                  ? "Group"
                  : "Audience",
            };
        return (
          <li key={holder} className="rounded-md border px-2 py-1 text-sm">
            <span>{displayed.label}</span>
            {option && option.kind !== "standing" ? (
              <span className="ml-2 text-xs text-muted-foreground">
                {displayed.kind}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function AudiencePicker({
  selected,
  options,
  disabled,
  onChange,
  onRefresh,
}: {
  selected: string[];
  options: AudienceOption[];
  disabled: boolean;
  onChange: (holders: string[]) => void;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState("");
  const matches = options.filter((option) =>
    `${option.label} ${option.kind}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  function toggle(holder: string) {
    if (selected.includes(holder))
      onChange(selected.filter((value) => value !== holder));
    else if (holder === "standing:everyone") onChange([holder]);
    else
      onChange(
        [
          ...selected.filter((value) => value !== "standing:everyone"),
          holder,
        ].sort(),
      );
  }
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <legend className="mb-2 text-sm font-medium">Addressed to</legend>
      <p className="text-xs text-muted-foreground">
        Groups share their membership with task lists. Current members can read
        all discussions addressed to their group, including earlier ones.{" "}
        <Link
          href="/tasks"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4"
        >
          Create or manage groups in Tasks (new tab)
        </Link>
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
        Refresh audiences
      </Button>
      <Label htmlFor="audience-search" className="sr-only">
        Find people or audiences
      </Label>
      <Input
        id="audience-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Find people, groups, or sections"
      />
      <div className="max-h-56 overflow-y-auto rounded-md border p-2">
        {matches.map((option) => (
          <label
            key={option.holder}
            className="flex cursor-pointer items-start gap-3 rounded p-2 hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.holder)}
              onChange={() => toggle(option.holder)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm">
                {audiencePresentation(option, options).label}
              </span>
              <span className="block text-xs text-muted-foreground">
                {audiencePresentation(option, options).kind}
              </span>
            </span>
          </label>
        ))}
        {!matches.length ? (
          <p className="p-2 text-sm text-muted-foreground">
            No matching audiences.
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
