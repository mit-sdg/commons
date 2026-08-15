"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/components/link";
import { Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const setupErrorMessages: Record<string, string> = {
  INVALID_REQUEST:
    "Check the username, email, display name, and password requirements.",
  UNAUTHORIZED: "The setup secret is incorrect or setup is not enabled.",
  CONFLICT: "Commons has already been initialized. Sign in instead.",
  INTERNAL_ERROR:
    "Setup could not be completed. Check server health before trying again.",
};

function setupErrorMessage(error: string): string {
  return (
    setupErrorMessages[error] ?? "Administrator setup could not be completed."
  );
}

export function AdminSetupForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [setupSecret, setSetupSecret] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorTarget, setErrorTarget] = useState<"confirmation" | "form">(
    "form",
  );
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const clearSensitiveFields = () => {
      setSetupSecret("");
      setPassword("");
      setConfirmPassword("");
    };
    window.addEventListener("pagehide", clearSensitiveFields);
    return () => window.removeEventListener("pagehide", clearSensitiveFields);
  }, []);

  useEffect(() => {
    if (created) completionHeadingRef.current?.focus();
  }, [created]);

  useEffect(() => {
    if (error === null) return;
    if (errorTarget === "confirmation") confirmationRef.current?.focus();
    else errorRef.current?.focus();
  }, [error, errorTarget]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setErrorTarget("confirmation");
      setError("The account passwords do not match.");
      confirmationRef.current?.focus();
      return;
    }

    setBusy(true);
    const account = {
      username: username.trim(),
      password,
      displayName: displayName.trim(),
      email: email.trim(),
    };
    const result = await api["/setup/register-admin"]({
      setupSecret,
      ...account,
    });
    setSetupSecret("");

    if ("error" in result) {
      setPassword("");
      setConfirmPassword("");
      setErrorTarget("form");
      setError(setupErrorMessage(result.error));
      setBusy(false);
      return;
    }

    try {
      await login(account.username, account.password);
      router.replace("/");
    } catch {
      setCreated(true);
      setBusy(false);
    } finally {
      setPassword("");
      setConfirmPassword("");
    }
  }

  if (created) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center px-4 py-10">
        <Card>
          <CardHeader>
            <h1
              ref={completionHeadingRef}
              tabIndex={-1}
              className="font-display text-2xl font-semibold outline-none"
            >
              Administrator created
            </h1>
            <CardDescription>
              Commons created the initial administrator, but automatic sign-in
              did not complete.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="eyebrow">Installation setup</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          Create the first administrator
        </h1>
      </div>
      <Card>
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-6"
          aria-busy={busy}
          aria-describedby={error ? "setup-form-error" : undefined}
        >
          <CardHeader>
            <CardTitle>Operator credentials</CardTitle>
            <CardDescription>
              This one-time form works only while administrator setup is enabled
              and Commons has no account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="setup-secret">Setup secret</Label>
              <Input
                id="setup-secret"
                type="password"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={1024}
                value={setupSecret}
                onChange={(event) => setSetupSecret(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="setup-username">Username</Label>
              <Input
                id="setup-username"
                autoComplete="username"
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z][A-Za-z0-9_-]*"
                title="Start with a letter and use only letters, digits, hyphens, and underscores."
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="setup-display-name">Display name</Label>
              <Input
                id="setup-display-name"
                autoComplete="name"
                maxLength={200}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="setup-email">Email</Label>
              <Input
                id="setup-email"
                type="email"
                autoComplete="email"
                maxLength={320}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="setup-password">Account password</Label>
              <Input
                id="setup-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="setup-confirm-password">Confirm password</Label>
              <Input
                ref={confirmationRef}
                id="setup-confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                aria-invalid={errorTarget === "confirmation" && error !== null}
                aria-describedby={
                  errorTarget === "confirmation" && error !== null
                    ? "setup-form-error"
                    : undefined
                }
                required
              />
            </div>
            {error ? (
              <p
                ref={errorRef}
                id="setup-form-error"
                role="alert"
                tabIndex={-1}
                className="text-sm text-destructive outline-none"
              >
                {error}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Spinner className="size-4" /> : null}
              {busy ? "Creating administrator…" : "Create administrator"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Remove <code>ADMIN_SETUP_SECRET_HASH</code> and redeploy after
              setup succeeds.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
