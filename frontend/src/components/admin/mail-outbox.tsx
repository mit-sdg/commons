"use client";

import { ChevronDown, Mail, RefreshCw, Search, X } from "lucide-react";
import { useId, useState } from "react";
import { Fact, Facts } from "@/components/facts";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type QueryState, useQuery } from "@/hooks/use-query";
import { api, type Output, withRequestErrors } from "@/lib/api";
import {
  countByStatus,
  filterMail,
  type MailDetail,
  type MailFilter,
  type MailStatus,
  mailStatus,
} from "@/lib/mail-ui";
import type { MailMessage } from "@/lib/models";
import { cn } from "@/lib/utils";
import { MailTextPreview } from "./mail-text-preview";

/** One colour per delivery outcome, used by the dot, the badge and the filter alike. */
const STATUS_STYLE: Record<
  MailStatus,
  { label: string; dot: string; badge: string }
> = {
  sent: {
    label: "Sent",
    dot: "bg-emerald-500",
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  failing: {
    label: "Failing",
    dot: "bg-destructive",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  queued: {
    label: "Queued",
    dot: "bg-amber-500",
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

const FILTERS: ReadonlyArray<{ value: MailFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "failing", label: "Failing" },
  { value: "queued", label: "Queued" },
  { value: "sent", label: "Sent" },
];

export function MailDetailView({ query }: { query: QueryState<MailDetail> }) {
  if (query.loading) return <LoadingState label="Loading message…" />;
  if (query.error) {
    return (
      <ErrorState
        message={
          query.refused === "NOT_FOUND"
            ? "This message is no longer available. It may have been deleted."
            : query.error
        }
        onRetry={query.refetch}
      />
    );
  }
  if (!query.data) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Invitation and password-reset credentials are redacted in this preview.
        Message text is shown without active links or HTML.
      </p>
      <MailTextPreview
        subject={query.data.subject}
        recipient={query.data.recipient}
        text={query.data.text}
      />
    </div>
  );
}

/** Mounted only by an opened disclosure, never by the metadata list itself. */
function MailDetailLoader({ message }: { message: MailMessage["message"] }) {
  const query = useQuery<MailDetail>(
    () => withRequestErrors(() => api.mail.read({ message })),
    [message],
  );
  return <MailDetailView query={query} />;
}

function MailOutboxRow({ message: m }: { message: MailMessage }) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  const status = mailStatus(m);
  const style = STATUS_STYLE[status];

  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <div className="flex min-w-0 items-start gap-3 p-4">
        <span
          aria-hidden="true"
          className={cn("mt-1.5 size-2 shrink-0 rounded-full", style.dot)}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="min-w-0 font-medium text-foreground">{m.subject}</p>
            <Fact.Status status={style.label} className={style.badge} />
          </div>
          <Facts className="text-xs text-muted-foreground">
            <span className="text-foreground/80">{m.recipient}</span>
            <Fact.When verb="Queued" at={m.createdAt} />
            {m.sentAt !== null ? <Fact.When verb="Sent" at={m.sentAt} /> : null}
            {m.sentAt === null && m.lastAttemptAt !== null ? (
              <Fact.When verb="Last tried" at={m.lastAttemptAt} />
            ) : null}
            {m.attempts > 0 ? (
              <Fact.Count n={m.attempts} noun="failed attempt" />
            ) : null}
          </Facts>
          {status === "failing" ? (
            <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
              {m.lastError}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          aria-expanded={open}
          aria-controls={detailId}
          aria-label={`${open ? "Close" : "Read"} email: ${m.subject}`}
          onClick={() => setOpen((previous) => !previous)}
        >
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
          <span className="hidden sm:inline">{open ? "Close" : "Read"}</span>
        </Button>
      </div>
      <div id={detailId} className={cn(open && "px-4 pb-4")}>
        {open ? <MailDetailLoader message={m.message} /> : null}
      </div>
    </div>
  );
}

export function MailOutbox({
  mailQuery,
}: {
  mailQuery: QueryState<Output<"/mail/list">>;
}) {
  const [filter, setFilter] = useState<MailFilter>("all");
  const [search, setSearch] = useState("");
  const searchId = useId();
  const messages = mailQuery.data?.messages ?? [];
  const counts = countByStatus(messages);
  const shown = filterMail(messages, search, filter);
  const searching = search.trim() !== "";

  return (
    <section
      aria-labelledby="outbox-heading"
      className="space-y-4"
      aria-busy={mailQuery.loading}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 id="outbox-heading" className="font-display text-lg font-semibold">
          Outbox
        </h3>
        <p className="text-sm text-muted-foreground">
          {counts.failing > 0
            ? `${counts.failing} ${counts.failing === 1 ? "message is" : "messages are"} not getting through.`
            : "Nothing is currently failing."}
        </p>
      </div>

      {mailQuery.loading && !mailQuery.data ? (
        <LoadingState label="Loading outbox…" />
      ) : mailQuery.error ? (
        <ErrorState message={mailQuery.error} onRetry={mailQuery.refetch} />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full min-w-0 space-y-1.5 sm:flex-1">
              <Label htmlFor={searchId}>Search subject or recipient</Label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id={searchId}
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9 pr-9"
                />
                {searching ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                  >
                    <X className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="self-start sm:self-auto"
              disabled={mailQuery.loading}
              onClick={mailQuery.refetch}
            >
              <RefreshCw
                aria-hidden="true"
                className={cn("size-3.5", mailQuery.loading && "animate-spin")}
              />
              {mailQuery.loading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>

          <div
            role="group"
            aria-label="Filter by delivery status"
            className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto px-1 pb-1"
          >
            {FILTERS.map((option) => {
              const n =
                option.value === "all" ? messages.length : counts[option.value];
              const active = filter === option.value;
              return (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  className="shrink-0 gap-1.5"
                  onClick={() => setFilter(option.value)}
                >
                  {option.value === "all" ? null : (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        STATUS_STYLE[option.value].dot,
                      )}
                    />
                  )}
                  {option.label}
                  <span className="tabular-nums opacity-70">{n}</span>
                </Button>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <EmptyState
              icon={Mail}
              title={
                searching
                  ? "No matching messages"
                  : filter === "all"
                    ? "No email yet"
                    : `No ${filter} messages`
              }
              description={
                searching
                  ? "No subject or recipient matches this search and filter."
                  : filter === "all"
                    ? "Commons has not queued any email yet."
                    : "Nothing in the outbox is in this state right now."
              }
            />
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {shown.map((message) => (
                <MailOutboxRow
                  key={String(message.message)}
                  message={message}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
