"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
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
import { api, CommonsError, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function AuthForm({
  mode,
  invitation: invitationProp,
}: {
  mode: "login" | "register";
  invitation?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useAuth();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [namePrefilled, setNamePrefilled] = useState(false);
  const askedFor = useRef<string | null>(null);
  const currentCredential = useRef("");
  const nameWasEdited = useRef(false);
  const usernameWasEdited = useRef(false);

  const isRegister = mode === "register";
  const invitation = invitationProp ?? searchParams.get("invitation") ?? "";

  /**
   * The link carries the invitation; the temporary password is typed from the
   * email, so the invitation can only be read once both are in hand. What comes
   * back fills the display name in and names the address the invitation was
   * sent to. It is a courtesy on the way to registering: a refusal here is
   * never shown and never blocks the form, which still succeeds on its own
   * terms.
   */
  async function readInvitation() {
    const credential = temporaryPassword.trim();
    if (!isRegister || invitation === "" || credential === "") return;
    const requestKey = `${invitation}:${credential}`;
    if (askedFor.current === requestKey) return;
    askedFor.current = requestKey;
    try {
      const result = await api.auth.invitation({
        invitation,
        temporaryPassword: credential,
      });
      if (
        askedFor.current !== requestKey ||
        currentCredential.current.trim() !== credential
      )
        return;
      if ("error" in result) {
        askedFor.current = null;
        return;
      }
      const details = result.invitation;
      if (!details) return;
      if (details.email) {
        const email = String(details.email);
        setInvitedEmail(email);
        if (!usernameWasEdited.current)
          setUsername(email.split("@", 1)[0] ?? "");
      }
      if (details.displayName && !nameWasEdited.current) {
        setDisplayName(String(details.displayName));
        setNamePrefilled(true);
      }
    } catch {
      if (askedFor.current === requestKey) askedFor.current = null;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isRegister) {
        await register(
          invitation,
          temporaryPassword,
          username.trim(),
          displayName.trim(),
        );
        toast.success("Account created.");
      } else {
        await login(username.trim(), password);
        toast.success("Signed in.");
      }
      router.push("/");
    } catch (err) {
      toast.error(
        err instanceof CommonsError
          ? err.message
          : publicErrorMessage("INTERNAL_ERROR"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="eyebrow">{isRegister ? "Register" : "Sign in"}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {isRegister ? "Create your Commons account" : "Sign in"}
        </h1>
      </div>
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <CardHeader>
            <CardTitle>Account details</CardTitle>
            <CardDescription>
              {isRegister
                ? "Enter the temporary password from your invitation. You can change it later."
                : "Enter your username and password."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {isRegister && invitedEmail ? (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Invitation for{" "}
                <span className="font-medium text-foreground break-all">
                  {invitedEmail}
                </span>
                .
              </p>
            ) : null}
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  usernameWasEdited.current = true;
                  setUsername(e.target.value);
                }}
                placeholder="ada"
                required
              />
            </div>
            {isRegister ? (
              <>
                <div className="flex flex-col gap-2.5">
                  <Label htmlFor="temporary-password">Temporary password</Label>
                  <Input
                    id="temporary-password"
                    type="password"
                    autoComplete="one-time-code"
                    value={temporaryPassword}
                    onChange={(e) => {
                      currentCredential.current = e.target.value;
                      askedFor.current = null;
                      setTemporaryPassword(e.target.value);
                    }}
                    onBlur={readInvitation}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2.5">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => {
                      nameWasEdited.current = true;
                      setDisplayName(e.target.value);
                      setNamePrefilled(false);
                    }}
                    placeholder="Ada Lovelace"
                    required
                  />
                  {namePrefilled ? (
                    <p className="text-sm text-muted-foreground">
                      Added from your invitation. You can change it.
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}
            {!isRegister ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Spinner className="size-4" /> : null}
              {isRegister ? "Accept invitation" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {isRegister ? (
                <>
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-primary hover:underline"
                  >
                    Sign in
                  </Link>
                </>
              ) : (
                "Registration is available by administrator invitation only."
              )}
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
