"use client";

import { Check, ChevronDown, Globe, Lock, X } from "lucide-react";
import { useState } from "react";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
import { InlineHelp } from "@/components/ui/inline-help";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Output } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profiles";

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

function RecipientName({
  option,
  options,
}: {
  option: AudienceOption;
  options: AudienceOption[];
}) {
  const { me } = useAuth();
  const profile = useProfile(
    option.kind === "account" ? option.identity : null,
  );
  return (
    <>
      {option.kind === "account" && option.identity === me?.user
        ? "You"
        : profile?.displayName || audiencePresentation(option, options).label}
    </>
  );
}

export function AudienceChips({
  holders,
  options,
  groupLinks,
}: {
  holders: string[];
  options: AudienceOption[];
  groupLinks?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const everyone = holders.includes("standing:everyone");
  const shown = everyone
    ? ["standing:everyone"]
    : expanded
      ? holders
      : holders.slice(0, 2);
  const Icon = everyone ? Globe : Lock;
  return (
    <span
      className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground"
      aria-label="Audience"
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span>Visible to</span>
      {shown.map((holder, index) => {
        const option = options.find((option) => option.holder === holder);
        return (
          <span key={holder}>
            {index > 0 ? "and " : ""}
            {everyone ? (
              "everyone in the course"
            ) : option ? (
              option.kind === "group" &&
              groupLinks?.includes(option.identity) ? (
                <Link
                  href={`/groups/${encodeURIComponent(option.identity)}?view=discussions`}
                  className="underline underline-offset-4"
                >
                  <RecipientName option={option} options={options} />
                </Link>
              ) : (
                <RecipientName option={option} options={options} />
              )
            ) : (
              "selected recipients"
            )}
          </span>
        );
      })}
      {!everyone && holders.length > 2 ? (
        <button
          type="button"
          className="underline underline-offset-4"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `+${holders.length - 2}`}
        </button>
      ) : null}
      {!everyone &&
      holders.some(
        (holder) =>
          holder.startsWith("group:") || holder.startsWith("section:"),
      ) ? (
        <InlineHelp label="Who can see this discussion?">
          Current group and section members can read this discussion. People who
          join later can read earlier posts too.
        </InlineHelp>
      ) : null}
    </span>
  );
}

function RecipientResult({
  option,
  options,
  query,
  checked,
  onSelect,
}: {
  option: AudienceOption;
  options: AudienceOption[];
  query: string;
  checked: boolean;
  onSelect: () => void;
}) {
  const profile = useProfile(
    option.kind === "account" ? option.identity : null,
  );
  if (
    !`${audiencePresentation(option, options).label} ${profile?.displayName ?? ""} ${option.kind}`
      .toLowerCase()
      .includes(query.toLowerCase())
  )
    return null;
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
    >
      <span className="min-w-0 flex-1">
        <RecipientName option={option} options={options} />{" "}
        <span className="ml-2 text-xs text-muted-foreground">
          {option.kind === "account"
            ? `@${option.label}`
            : audiencePresentation(option, options).kind}
        </span>
      </span>
      {checked ? <Check className="size-4 shrink-0" /> : null}
    </button>
  );
}

function RecipientSearch({
  options,
  selected,
  onSelect,
}: {
  options: AudienceOption[];
  selected: string[];
  onSelect: (holder: string) => void;
}) {
  const [query, setQuery] = useState("");
  return (
    <>
      <Input
        autoFocus
        aria-label="Find people, groups, or sections"
        placeholder="Find people, groups, or sections…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            event.currentTarget.parentElement
              ?.querySelector<HTMLElement>('[role="option"]')
              ?.focus();
          }
        }}
      />
      <div
        role="listbox"
        aria-label="Recipients"
        aria-multiselectable="true"
        className="mt-2 max-h-60 overflow-y-auto"
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              '[role="option"]',
            ),
          );
          const index = items.indexOf(document.activeElement as HTMLElement);
          items[
            (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length
          ]?.focus();
        }}
      >
        {options.map((option) => (
          <RecipientResult
            key={option.holder}
            option={option}
            options={options}
            query={query}
            checked={selected.includes(option.holder)}
            onSelect={() => onSelect(option.holder)}
          />
        ))}
        <p className="hidden p-2 text-sm text-muted-foreground only:block">
          No matching recipients.
        </p>
      </div>
    </>
  );
}

export function AudiencePicker({
  selected,
  options,
  disabled,
  onChange,
  onRefresh,
  error,
  loading,
}: {
  selected: string[];
  options: AudienceOption[];
  disabled: boolean;
  onChange: (holders: string[]) => void;
  onRefresh: () => void;
  error: string | null;
  loading: boolean;
}) {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const selectable = options.filter(
    (option) =>
      option.holder !== `account:${me?.user}` &&
      option.holder !== "standing:everyone",
  );
  const label = selected.includes("standing:everyone")
    ? "Everyone in the course"
    : selected.length === 1 && selected[0] === "standing:staff"
      ? "Staff privately"
      : selected.length
        ? `${selected.length} selected`
        : "Choose people or groups";
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) onRefresh();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className="gap-2"
          aria-label={`Who can see this? ${label}`}
        >
          {label.endsWith(" selected") ? (
            <span className="max-w-52 truncate">
              {selected.slice(0, 2).map((holder, index) => {
                const option = options.find((entry) => entry.holder === holder);
                return (
                  <span key={holder}>
                    {index ? ", " : ""}
                    {option ? (
                      <RecipientName option={option} options={options} />
                    ) : (
                      "Unavailable recipient"
                    )}
                  </span>
                );
              })}
              {selected.length > 2 ? ` +${selected.length - 2}` : ""}
            </span>
          ) : (
            label
          )}
          <ChevronDown className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)] p-2"
      >
        <div className="space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onChange(["standing:everyone"]);
              setOpen(false);
            }}
          >
            <Globe className="size-4" />
            Everyone in the course
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onChange(["standing:staff"]);
              setOpen(false);
            }}
          >
            <Lock className="size-4" />
            Staff privately
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => setCustom(true)}
          >
            Choose people or groups…
          </Button>
        </div>
        {custom ? (
          <div className="mt-2 border-t pt-2">
            {error ? (
              <p role="alert" className="p-2 text-sm">
                Couldn’t load recipients.{" "}
                <button type="button" className="underline" onClick={onRefresh}>
                  Retry
                </button>
              </p>
            ) : loading && !options.length ? (
              <p role="status" className="p-2 text-sm">
                Loading recipients…
              </p>
            ) : (
              <RecipientSearch
                options={selectable}
                selected={selected}
                onSelect={(holder) =>
                  onChange(
                    selected.includes(holder)
                      ? selected.filter((value) => value !== holder)
                      : [
                          ...selected.filter(
                            (value) => value !== "standing:everyone",
                          ),
                          holder,
                        ],
                  )
                }
              />
            )}
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function AudienceFilter({
  options,
  value,
  onChange,
}: {
  options: AudienceOption[];
  value: string;
  onChange: (holder: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const option = options.find((option) => option.holder === value);
  return (
    <span className="inline-flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {value ? (
              <>
                To:{" "}
                {option ? (
                  <RecipientName option={option} options={options} />
                ) : (
                  "Unavailable recipient"
                )}
              </>
            ) : (
              "Addressed to…"
            )}
            <ChevronDown className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 max-w-[calc(100vw-2rem)] p-2"
        >
          <RecipientSearch
            options={options}
            selected={value ? [value] : []}
            onSelect={(holder) => {
              onChange(holder);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Clear recipient filter"
          onClick={() => onChange("")}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </span>
  );
}
