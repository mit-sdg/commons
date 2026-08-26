"use client";

import { ArrowRight, Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, isApiError } from "@/lib/api";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function join(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api["/live/p/locate"]({ code });
      if (isApiError(result)) {
        setMessage("We couldn't find that code. Check all six characters.");
        return;
      }
      router.push(`/q/${result.token}`);
    } catch {
      setMessage(
        "We couldn't reach Commons. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Radio aria-hidden="true" className="size-6" />
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Join a live session
        </h1>
        <p className="mt-2 text-muted-foreground">
          Enter the six-character code shown by your instructor.
        </p>
      </div>

      <form className="space-y-4" onSubmit={join}>
        <div className="space-y-2">
          <Label htmlFor="join-code">Session code</Label>
          <Input
            id="join-code"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            maxLength={6}
            aria-invalid={message !== null}
            aria-describedby={message === null ? undefined : "join-error"}
            onChange={(event) => {
              setCode(
                event.target.value
                  .toUpperCase()
                  .replace(/[^A-HJ-NP-Z2-9]/g, "")
                  .slice(0, 6),
              );
              setMessage(null);
            }}
            className="h-14 text-center font-mono text-2xl tracking-[0.16em] uppercase"
          />
          <p
            id="join-error"
            aria-live="polite"
            className="min-h-5 text-destructive text-sm"
          >
            {message}
          </p>
        </div>
        <Button className="h-11 w-full" disabled={busy || code.length !== 6}>
          {busy ? "Joining…" : "Join"} <ArrowRight />
        </Button>
      </form>
    </div>
  );
}
