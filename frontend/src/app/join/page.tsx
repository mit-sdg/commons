"use client";

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
        setMessage("No run has that code.");
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
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Join
        </h1>
      </div>

      <form className="space-y-4" onSubmit={join}>
        <div className="space-y-2">
          <Label htmlFor="join-code">Code</Label>
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
          {busy ? "Joining…" : "Join"}
        </Button>
      </form>
    </div>
  );
}
