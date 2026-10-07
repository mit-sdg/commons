"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/components/link";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, isApiError, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  approvedCallback,
  type ConnectChallenge,
  connectRequest,
  deniedCallback,
} from "@/lib/connect";

type Stage =
  | { kind: "checking" }
  | { kind: "invalid" }
  | { kind: "failed"; message: string }
  | { kind: "asking"; host: string; callback: string }
  | { kind: "leaving"; label: string };

function ConnectShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      {children}
    </div>
  );
}

/**
 * An app sent the browser here to learn who its person is. The page shows no
 * Commons chrome and never sends the browser anywhere Commons has not
 * accepted as that app's own callback.
 */
export function ConnectConsent() {
  const searchParams = useSearchParams();
  const request = connectRequest(searchParams);
  if (request === null) return <InvalidRequest />;
  // A new request starts its own exchange with Commons from the beginning.
  return (
    <ConsentFlow
      key={`${request.app}\n${request.state}\n${request.challenge?.code_challenge ?? ""}`}
      app={request.app}
      state={request.state}
      challenge={request.challenge}
    />
  );
}

function InvalidRequest() {
  return (
    <ConnectShell>
      <p className="eyebrow mb-4 text-center">Sign in with Commons</p>
      <Card>
        <CardHeader>
          <CardTitle>This app can&apos;t use Commons sign-in.</CardTitle>
          <CardDescription>
            The link that opened this page is incomplete, or it names an app
            Commons does not sign people in to. Nothing was shared.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link
            href="/"
            className="text-sm font-medium text-primary hover:underline"
          >
            Go to Commons
          </Link>
        </CardFooter>
      </Card>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        For the app&apos;s developer: a sign-in link names <code>app</code>,{" "}
        <code>state</code>, and a <code>code_challenge</code> of 43 base64url
        characters with <code>code_challenge_method=S256</code>.
      </p>
    </ConnectShell>
  );
}

function ConsentFlow({
  app,
  state,
  challenge,
}: {
  app: string;
  state: string;
  challenge: ConnectChallenge | null;
}) {
  const { me, logout } = useAuth();
  const [stage, setStage] = useState<Stage>({ kind: "checking" });
  const [attempt, setAttempt] = useState(0);
  // Each approval issues a new code and retires the last, so one is asked for
  // at a time, and never twice for one look at the app.
  const asked = useRef(-1);

  async function approve(host: string) {
    setStage({ kind: "leaving", label: `Signing you in to ${host}…` });
    try {
      const result = await api.connect.approve({ app, ...challenge });
      if (isApiError(result)) {
        if (result.error === "INVALID_REQUEST") setStage({ kind: "invalid" });
        else
          setStage({
            kind: "failed",
            message: publicErrorMessage(result.error),
          });
        return;
      }
      window.location.assign(
        approvedCallback(result.callback, result.code, state),
      );
    } catch {
      setStage({
        kind: "failed",
        message: publicErrorMessage("INTERNAL_ERROR"),
      });
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: one look at the app per attempt; approve reads the same app, state, and challenge.
  useEffect(() => {
    if (asked.current === attempt) return;
    asked.current = attempt;
    void (async () => {
      try {
        const described = await api.connect.describe({ app, ...challenge });
        if (isApiError(described)) {
          setStage(
            described.error === "INVALID_REQUEST"
              ? { kind: "invalid" }
              : {
                  kind: "failed",
                  message: publicErrorMessage(described.error),
                },
          );
          return;
        }
        if (described.approved) await approve(described.host);
        else
          setStage({
            kind: "asking",
            host: described.host,
            callback: described.callback,
          });
      } catch {
        setStage({
          kind: "failed",
          message: publicErrorMessage("INTERNAL_ERROR"),
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (stage.kind === "invalid") return <InvalidRequest />;
  if (stage.kind === "checking")
    return <LoadingState label="Checking the app…" />;
  if (stage.kind === "leaving") return <LoadingState label={stage.label} />;
  if (stage.kind === "failed")
    return (
      <ConnectShell>
        <ErrorState
          message={stage.message}
          onRetry={() => {
            setStage({ kind: "checking" });
            setAttempt((n) => n + 1);
          }}
        />
      </ConnectShell>
    );

  const { host, callback } = stage;
  const username = me ? String(me.username) : "";
  const name = me?.profile.displayName.trim() || username;

  function cancel() {
    setStage({ kind: "leaving", label: `Returning to ${host}…` });
    window.location.assign(deniedCallback(callback, state));
  }

  return (
    <ConnectShell>
      <div className="mb-8 text-center">
        <p className="eyebrow">Sign in with Commons</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight break-all">
          {host}
        </h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground break-all">
          {app}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>This app will learn</CardTitle>
          <CardDescription>
            Commons remembers your answer until you remove the app in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="min-w-0 break-words">{name}</dd>
            <dt className="text-muted-foreground">Username</dt>
            <dd className="min-w-0 break-all">@{username}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="min-w-0 break-all">{me?.email}</dd>
          </dl>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="flex w-full gap-3">
            <Button variant="outline" className="flex-1" onClick={cancel}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => void approve(host)}>
              Allow
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">@{username}</span>.{" "}
            <button
              type="button"
              onClick={() => void logout()}
              className="font-medium text-primary hover:underline"
            >
              Use another account
            </button>
          </p>
        </CardFooter>
      </Card>
    </ConnectShell>
  );
}
