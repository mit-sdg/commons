"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
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
import { CommonsError, publicErrorMessage } from "@/lib/api";
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

  const isRegister = mode === "register";
  const invitation = invitationProp ?? searchParams.get("invitation") ?? "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isRegister) {
        await register(
          invitation,
          temporaryPassword,
          username.trim(),
          password,
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
                ? "Use the temporary password from your invitation email, then choose your account details."
                : "Enter your username and password to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ada"
                required
              />
            </div>
            {isRegister ? (
              <>
                <div className="flex flex-col gap-2.5">
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ada Lovelace"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2.5">
                  <Label htmlFor="temporary-password">Temporary password</Label>
                  <Input
                    id="temporary-password"
                    type="password"
                    autoComplete="one-time-code"
                    value={temporaryPassword}
                    onChange={(e) => setTemporaryPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : null}
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
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
