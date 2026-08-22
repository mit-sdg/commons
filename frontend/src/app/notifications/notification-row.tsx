"use client";

import {
  Ban,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  ClipboardList,
  ListChecks,
  MessageCircle,
  RotateCcw,
  Undo2,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Fragment, useState } from "react";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { count, excerpt, relativeTime } from "@/lib/format";
import type { InboxNotification, TaskInboxNotification } from "@/lib/models";
import {
  hasTaskPresentation,
  type MergedNotification,
  type NotificationGroup,
  type TaskNotificationKind,
  taskActionText,
  taskRowDetail,
  withheldTaskNote,
} from "@/lib/task-notifications";
import { cn } from "@/lib/utils";

/** The forum instance's four kinds, said exactly as they have always been. */
export function actionText(kind: string): string {
  switch (kind) {
    case "reply":
      return "replied to your post";
    case "followed_reply":
      return "replied in a topic you follow";
    case "mention":
      return "mentioned you";
    case "accepted":
      return "accepted your answer";
    default:
      return kind;
  }
}

/** A glyph per task-domain kind, so the eight read apart at a glance. */
const TASK_ICONS: Record<TaskNotificationKind, typeof ListChecks> = {
  "task-list-added": UserPlus,
  "task-list-removed": UserMinus,
  "task-assigned": ClipboardList,
  "task-retimed": CalendarClock,
  "task-canceled": Ban,
  "task-uncanceled": Undo2,
  "task-reopened": RotateCcw,
  "task-completed": CircleCheck,
};

const INTERACTIVE =
  'a, button, input, textarea, select, summary, [role="button"], [role="menuitem"]';

/**
 * Whether a click landed on something with an action of its own.
 *
 * The row itself carries `role="button"` when it leads nowhere, so it matches
 * this selector too; a row must not count as its own nested control, or it
 * would swallow every click and never mark itself read. Excluding the row
 * element leaves the mark-read and dismiss buttons inside it still handled.
 */
function isInteractiveTarget(
  target: EventTarget | null,
  row: Element | null,
): boolean {
  if (!(target instanceof Element)) return false;
  const hit = target.closest(INTERACTIVE);
  return hit !== null && hit !== row;
}

function renderExcerptWithMentions(content: string) {
  const text = excerpt(content);
  const parts: { key: string; value: string | { username: string } }[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(/@[a-zA-Z0-9_]+/g)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({
        key: `text-${lastIndex}-${index}`,
        value: text.slice(lastIndex, index),
      });
    }
    const username = match[0].slice(1);
    parts.push({ key: `mention-${index}-${username}`, value: { username } });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({
      key: `text-${lastIndex}-${text.length}`,
      value: text.slice(lastIndex),
    });
  }

  return parts.map((part) =>
    typeof part.value === "string" ? (
      <Fragment key={part.key}>{part.value}</Fragment>
    ) : (
      <Link
        key={part.key}
        href={`/u/${part.value.username}`}
        className="font-medium text-primary hover:underline"
      >
        @{part.value.username}
      </Link>
    ),
  );
}

/** The circle a task row wears in place of an author's avatar. */
function KindIcon({ kind }: { kind: string }) {
  const Icon = TASK_ICONS[kind as TaskNotificationKind] ?? ListChecks;
  return (
    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
      <Icon className="size-3.5 text-primary" />
    </span>
  );
}

function headlineClass(unread: boolean): string {
  return cn(
    "truncate text-sm",
    unread ? "font-semibold text-foreground" : "text-muted-foreground",
  );
}

/** A forum row: the same wording, the same avatar, the same mentions. */
function ForumNotificationBody({
  n,
  unread,
}: {
  n: InboxNotification;
  unread: boolean;
}) {
  const post = n.post;
  const actor = n.actor;
  const said = actionText(n.kind);
  const capitalized = said.charAt(0).toUpperCase() + said.slice(1);

  if (post && actor && n.kind !== "accepted") {
    return (
      <>
        <UserAvatar
          user={String(actor.user)}
          name={actor.displayName || actor.username || undefined}
          avatar={actor.avatar || undefined}
          className="mt-0.5 size-7 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm", unread && "font-semibold")}>
            <Link
              href={`/u/${String(actor.user)}`}
              className="font-medium text-foreground hover:text-primary hover:underline underline-offset-2"
            >
              {actor.displayName || actor.username}
            </Link>{" "}
            <span className="text-muted-foreground">{said}</span>
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
            {renderExcerptWithMentions(post.content ?? "")}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
        {post ? (
          <Check className="size-3.5 text-primary" />
        ) : (
          <MessageCircle className="size-3.5 text-primary" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={headlineClass(unread)}>{capitalized}</p>
        {post ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
            {renderExcerptWithMentions(post.content ?? "")}
          </p>
        ) : null}
      </div>
    </>
  );
}

/**
 * A task row: its kind's own sentence, then one dim line of context. Where the
 * inbox withheld presentation the row says so instead of going blank.
 */
function TaskNotificationBody({
  row,
  unread,
}: {
  row: TaskInboxNotification;
  unread: boolean;
}) {
  const kind = String(row.kind);
  const detail = taskRowDetail(row);
  return (
    <>
      <KindIcon kind={kind} />
      <div className="min-w-0 flex-1">
        <p className={headlineClass(unread)}>{taskActionText(kind)}</p>
        {hasTaskPresentation(row) ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
            {detail}
          </p>
        ) : (
          <p className="mt-0.5 truncate text-xs italic text-muted-foreground/80">
            {withheldTaskNote(kind)}
          </p>
        )}
      </div>
    </>
  );
}

/**
 * Row actions stay out of the way until they are wanted: revealed on hover,
 * revealed by keyboard focus, and always present where there is no pointer to
 * hover with.
 */
const ROW_ACTIONS = cn(
  "absolute inset-y-0 right-0 flex items-center gap-0.5 opacity-0 transition-opacity",
  "pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto",
  "group-hover:opacity-100 group-focus-within:opacity-100",
  "pointer-coarse:static pointer-coarse:pointer-events-auto pointer-coarse:opacity-100",
);

export interface EntryProps {
  entry: MergedNotification;
  href: string | null;
  onActivate: () => void;
  onMarkRead: () => void;
  onDismiss: () => void;
  /** Paint the unread dot even for a read lead row, when its group holds unread rows. */
  unreadHint?: boolean;
  markReadLabel?: string;
  /** Let a surrounding group own the border. */
  bare?: boolean;
  /** Extra content under the body, such as a group's expand toggle. */
  children?: ReactNode;
}

/** One row, in the layout both surfaces share. */
export function NotificationEntry({
  entry,
  href,
  onActivate,
  onMarkRead,
  onDismiss,
  unreadHint,
  markReadLabel = "Mark read",
  bare = false,
  children,
}: EntryProps) {
  const unread = !entry.read;
  const flagged = unread || Boolean(unreadHint);

  function handleClick(e: MouseEvent<HTMLElement>) {
    if (isInteractiveTarget(e.target, e.currentTarget)) return;
    onActivate();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (isInteractiveTarget(e.target, e.currentTarget)) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onActivate();
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the row opens what it points at while the buttons inside it keep their own actions.
    <div
      className={cn(
        "group flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors",
        bare ? "bg-transparent" : "rounded-lg border border-border bg-card",
        "cursor-pointer hover:bg-muted/40",
      )}
      role={href ? "link" : "button"}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-2.5 size-2 shrink-0 rounded-full",
          flagged ? "bg-primary" : "bg-transparent",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-start gap-2.5">
          {entry.source === "forum" ? (
            <ForumNotificationBody n={entry.row} unread={flagged} />
          ) : (
            <TaskNotificationBody row={entry.row} unread={flagged} />
          )}
        </div>
        {children}
      </div>
      <div className="relative flex shrink-0 items-center gap-0.5 pt-0.5">
        <span
          className={cn(
            "whitespace-nowrap text-right text-xs text-muted-foreground transition-opacity",
            "group-hover:opacity-0 group-focus-within:opacity-0 pointer-coarse:opacity-100",
          )}
        >
          {relativeTime(entry.createdAt)}
        </span>
        <div className={ROW_ACTIONS}>
          {flagged ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={onMarkRead}
              aria-label={markReadLabel}
              title={markReadLabel}
            >
              <Check className="size-4" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={onDismiss}
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export interface GroupProps {
  group: NotificationGroup;
  hrefOf: (entry: MergedNotification) => string | null;
  onActivate: (entry: MergedNotification) => void;
  onMarkRead: (entries: MergedNotification[]) => void;
  onDismiss: (entry: MergedNotification) => void;
}

/**
 * A run of updates about one subject, as one entry.
 *
 * Collapsed, it shows the newest event in that kind's own words, says how many
 * updates it holds and how many are unread, and marks the whole run read at
 * once. Expanded, every row underneath is a row again, with its own wording and
 * its own two actions.
 */
export function NotificationGroupEntry({
  group,
  hrefOf,
  onActivate,
  onMarkRead,
  onDismiss,
}: GroupProps) {
  const [expanded, setExpanded] = useState(false);
  const lead = group.lead;

  if (group.entries.length === 1) {
    return (
      <NotificationEntry
        entry={lead}
        href={hrefOf(lead)}
        onActivate={() => onActivate(lead)}
        onMarkRead={() => onMarkRead([lead])}
        onDismiss={() => onDismiss(lead)}
      />
    );
  }

  const summary = count(group.entries.length, "update");
  const label =
    group.unread > 0 ? `${summary} · ${group.unread} unread` : summary;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <NotificationEntry
        entry={lead}
        href={hrefOf(lead)}
        onActivate={() => onActivate(lead)}
        onMarkRead={() => onMarkRead(group.entries)}
        onDismiss={() => onDismiss(lead)}
        unreadHint={group.unread > 0}
        markReadLabel={`Mark ${summary} read`}
        bare
      >
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="mt-1 ml-[2.375rem] flex w-fit items-center gap-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-1 focus-visible:outline-ring"
        >
          {expanded ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
          {label}
        </button>
      </NotificationEntry>
      {expanded ? (
        <div className="divide-y divide-border border-t border-border bg-muted/20">
          {group.entries.map((entry) => (
            <NotificationEntry
              key={`${entry.source}:${entry.id}`}
              entry={entry}
              href={hrefOf(entry)}
              onActivate={() => onActivate(entry)}
              onMarkRead={() => onMarkRead([entry])}
              onDismiss={() => onDismiss(entry)}
              bare
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A merged list, grouped, in the order it was given. */
export function NotificationList({
  groups,
  hrefOf,
  onActivate,
  onMarkRead,
  onDismiss,
  className,
}: Omit<GroupProps, "group"> & {
  groups: NotificationGroup[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {groups.map((group) => (
        <NotificationGroupEntry
          key={group.key}
          group={group}
          hrefOf={hrefOf}
          onActivate={onActivate}
          onMarkRead={onMarkRead}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
