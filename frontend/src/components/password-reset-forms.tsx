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
import { api, isApiError, publicErrorMessage } from "@/lib/api";

function ResetShell({
  eyebrow,
  heading,
  children,
}: {
  eyebrow: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {heading}
        </h1>
      </div>
      {children}
    </div>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api.auth["request-password-reset"]({
        email: email.trim(),
      });
      if (isApiError(result)) {
        toast.error(publicErrorMessage(result.error));
        return;
      }
      setSent(true);
    } catch {
      toast.error(publicErrorMessage("INTERNAL_ERROR"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResetShell eyebrow="Reset" heading="Forgot your password?">
      <Card>
        {sent ? (
          <>
            <CardHeader>
              <CardTitle>Check your email</CardTitle>
              <CardDescription>
                If that address has a Commons account, a reset email is on its
                way. The link expires in one hour.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <p className="w-full text-center text-sm text-muted-foreground">
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline"
                >
                  Back to sign in
                </Link>
              </p>
            </CardFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <CardHeader>
              <CardTitle>Reset by email</CardTitle>
              <CardDescription>
                Enter your account email and we will send a reset link.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-2.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ada@example.edu"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Spinner className="size-4" /> : null}
                Send reset email
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Remembered it?{" "}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </ResetShell>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const voucher = searchParams.get("voucher") ?? "";
  const [credential, setCredential] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api.auth["reset-password"]({
        voucher,
        credential: credential.trim(),
        newPassword,
      });
      if (isApiError(result)) {
        toast.error(
          result.error === "UNAUTHORIZED"
            ? "That reset link is invalid or has expired. Request a new one."
            : publicErrorMessage(result.error),
        );
        setBusy(false);
        return;
      }
      toast.success("Password reset. Sign in with your new password.");
      // The voucher is spent. Stay busy until the sign-in page replaces this
      // form, so a second click cannot report a failure that did not happen.
      router.push("/login");
    } catch {
      toast.error(publicErrorMessage("INTERNAL_ERROR"));
      setBusy(false);
    }
  }

  if (voucher === "") {
    return (
      <ResetShell eyebrow="Reset" heading="Reset your password">
        <Card>
          <CardHeader>
            <CardTitle>Missing reset link</CardTitle>
            <CardDescription>
              Open the link from your reset email, or request a new one.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <p className="w-full text-center text-sm text-muted-foreground">
              <Link
                href="/forgot-password"
                className="font-medium text-primary hover:underline"
              >
                Request a reset email
              </Link>
            </p>
          </CardFooter>
        </Card>
      </ResetShell>
    );
  }

  return (
    <ResetShell eyebrow="Reset" heading="Reset your password">
      <Card>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <CardHeader>
            <CardTitle>Choose a new password</CardTitle>
            <CardDescription>
              Use the reset code from your email, then choose a new password.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="reset-code">Reset code</Label>
              <Input
                id="reset-code"
                autoComplete="one-time-code"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Spinner className="size-4" /> : null}
              Reset password
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Link not working?{" "}
              <Link
                href="/forgot-password"
                className="font-medium text-primary hover:underline"
              >
                Request a new one
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </ResetShell>
  );
}
