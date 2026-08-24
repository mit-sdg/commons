"use client";

import { CircleAlert, CircleCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Input as EndpointInput } from "@/lib/api";
import { api, publicErrorMessage } from "@/lib/api";
import { addedPersonMessage, addPersonRefusal } from "@/lib/roster-messages";
import { seatStandingAt } from "@/lib/roster-people";
import { cn } from "@/lib/utils";

/** Radix needs a value for every option, so "unset" carries one of its own. */
const UNSET = "__unset__";

export interface PendingSeatSummary {
  email: string;
  kind: string;
  section: string | null;
}

export interface AddPersonPrefill {
  email: string;
  displayName: string;
  kind: string;
  /** Whether the form was opened by the caller to add themselves. */
  self: boolean;
}

interface AddPersonFormProps {
  kinds: string[];
  sections: { section: string; name: string; status: string }[];
  seats: {
    active: string[];
    dropped: string[];
    pending: PendingSeatSummary[];
  };
  prefill: AddPersonPrefill | null;
  onAdded: () => void;
}

/**
 * Adding one person by hand, which reaches the same import a one-row CSV does.
 *
 * The answer says whether a seat was created and what the address resolved to
 * while the request ran; the claim and the invitation commit after it. So the
 * form says exactly that much and refetches the rosters, which are the durable
 * answer to what became of the seat.
 */
export function AddPersonForm({
  kinds,
  sections,
  seats,
  prefill,
  onAdded,
}: AddPersonFormProps) {
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [displayName, setDisplayName] = useState(prefill?.displayName ?? "");
  const [kind, setKind] = useState(prefill?.kind ?? "STUDENT");
  const [section, setSection] = useState(UNSET);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{
    tone: "added" | "refused";
    message: string;
  } | null>(null);

  const activeSections = sections.filter((entry) => entry.status === "ACTIVE");
  const trimmedEmail = email.trim();

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (busy || trimmedEmail === "") return;
    const chosenSection = section === UNSET ? "" : section;
    const chosenKind = kind === UNSET ? "" : kind;
    const request: EndpointInput<"/roster/add-person"> = {
      email: trimmedEmail,
    };
    if (chosenKind !== "") request.kind = chosenKind;
    if (chosenSection !== "") request.section = chosenSection;
    if (displayName.trim() !== "") request.displayName = displayName.trim();

    setBusy(true);
    try {
      const result = await api.roster["add-person"](request);
      if ("error" in result) {
        setOutcome({
          tone: "refused",
          message: addPersonRefusal(result.error, {
            email: trimmedEmail,
            standing: seatStandingAt(trimmedEmail, {
              active: seats.active,
              dropped: seats.dropped,
              pending: seats.pending.map((seat) => seat.email),
            }),
            section: chosenSection !== "",
          }),
        });
        return;
      }
      // A seat that was already standing keeps the kind and section it was
      // created with, so say so when this form asked for something else.
      const standing = seats.pending.find(
        (seat) =>
          seat.email.trim().toLowerCase() === trimmedEmail.toLowerCase(),
      );
      const keptSettings =
        !result.created &&
        standing !== undefined &&
        ((chosenKind !== "" && chosenKind !== standing.kind) ||
          (chosenSection !== "" && chosenSection !== standing.section));
      setOutcome({
        tone: "added",
        message: addedPersonMessage(result, trimmedEmail, keptSettings),
      });
      setEmail("");
      setDisplayName("");
      onAdded();
    } catch {
      setOutcome({
        tone: "refused",
        message: publicErrorMessage("INTERNAL_ERROR"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="space-y-4">
      {prefill?.self && outcome === null ? (
        <p className="rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
          You&apos;re adding <span className="font-medium">yourself</span>
          {prefill.displayName ? ` — ${prefill.displayName}` : ""} as staff.
          Review the details, then confirm.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="add-person-email">Email address</Label>
          <Input
            id="add-person-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="jdoe@school.edu"
            // The home page's self-add opens this form for confirming, so the
            // person lands in it rather than hunting for it on the page.
            autoFocus={prefill !== null}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-person-name">Display name (optional)</Label>
          <Input
            id="add-person-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Jamie Doe"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-person-kind">Kind</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger id="add-person-kind" className="w-full">
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>Not set</SelectItem>
              {kinds.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {entry.toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="add-person-section">Section</Label>
          <Select
            value={section}
            onValueChange={setSection}
            disabled={activeSections.length === 0}
          >
            <SelectTrigger id="add-person-section" className="w-full">
              <SelectValue placeholder="Not set" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSET}>Not set</SelectItem>
              {activeSections.map((entry) => (
                <SelectItem key={entry.section} value={entry.section}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || trimmedEmail === ""}>
          <UserPlus className="size-4" />
          {busy ? "Adding…" : "Add to roster"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Existing accounts are enrolled. Everyone else gets an email
          invitation.
        </p>
      </div>

      {outcome ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "flex items-start gap-2 rounded-lg border p-3 text-sm",
            outcome.tone === "added"
              ? "border-primary/25 bg-primary/5 text-foreground"
              : "border-destructive/30 bg-destructive/5 text-destructive",
          )}
        >
          {outcome.tone === "added" ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{outcome.message}</span>
        </p>
      ) : null}
    </form>
  );
}
