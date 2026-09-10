"use client";

import { Check, Hand, Presentation } from "lucide-react";
import { type ReactNode, useState } from "react";
import { renderSVG } from "uqr";
import { QuestionCard } from "@/components/live/phone-question";
import { RoundToken } from "@/components/live/round-token";
import { Button } from "@/components/ui/button";
import { count } from "@/lib/format";

function Pile({
  name,
  cards,
  picked = false,
}: {
  name: string;
  cards: string[];
  picked?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg border bg-card p-3 ${picked ? "border-primary" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{name}</span>
        {picked ? <Check className="size-4 shrink-0 text-primary" /> : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {cards.length} {cards.length === 1 ? "response" : "responses"}
      </p>
      <div className="mt-3 space-y-2">
        {cards.map((card) => (
          <p
            key={card}
            className="rounded-md bg-muted/50 px-2 py-2 text-xs leading-relaxed"
          >
            {card}
          </p>
        ))}
      </div>
    </div>
  );
}

function Screen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium">
        {name}
        <span className="ml-2 font-normal text-muted-foreground">Example</span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </div>
  );
}

function Action({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div className="w-full rounded-md ring-2 ring-primary ring-offset-4 ring-offset-background">
        {children}
      </div>
    </div>
  );
}

function SortingExample() {
  const [moved, setMoved] = useState(false);
  return (
    <Screen name="Host dashboard">
      <RoundToken number={1} title="What went wrong?" size="sm" />
      <div className="flex items-center gap-2 text-xs">
        <span className="h-4 w-7 rounded-full bg-muted-foreground/30 p-0.5">
          <span className="block size-3 rounded-full bg-background" />
        </span>
        Sort automatically
      </div>
      <div className="space-y-2 border-y py-3">
        <span className="text-xs text-muted-foreground">
          {count(moved ? 0 : 1, "card")} unsorted
        </span>
        {moved ? (
          <Button size="sm" variant="ghost" onClick={() => setMoved(false)}>
            Reset example
          </Button>
        ) : (
          <div
            draggable
            onDragStart={(event) =>
              event.dataTransfer.setData("text/plain", "example-response")
            }
            className="w-fit cursor-grab rounded-md border bg-card p-3 text-xs shadow-sm"
          >
            I closed the tab and lost my draft.
          </div>
        )}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Hand className="size-4" />
        Drag the unsorted response onto Lost work.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (event.dataTransfer.getData("text/plain") === "example-response")
              setMoved(true);
          }}
        >
          <Pile
            name="Lost work"
            cards={
              moved
                ? [
                    "My notes disappeared when the page reloaded.",
                    "I closed the tab and lost my draft.",
                  ]
                : ["My notes disappeared when the page reloaded."]
            }
          />
        </div>
        <Pile
          name="Slow sign-in"
          cards={["The login code arrived after it expired."]}
        />
      </div>
      {!moved ? (
        <Button size="sm" variant="ghost" onClick={() => setMoved(true)}>
          Show the result
        </Button>
      ) : null}
    </Screen>
  );
}

function CarryExample() {
  const [use, setUse] = useState("choices");
  const [kind, setKind] = useState("Write");
  const groups = [
    {
      name: "Lost work",
      cards: ["My notes disappeared when the page reloaded."],
    },
    {
      name: "Slow sign-in",
      cards: ["The login code arrived after it expired."],
    },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Use selected piles as</span>
        {["choices", "parts", "context"].map((value) => (
          <Button
            key={value}
            size="sm"
            variant={use === value ? "secondary" : "outline"}
            aria-pressed={use === value}
            onClick={() => setUse(value)}
          >
            {value}
          </Button>
        ))}
      </div>
      {use === "context" ? (
        <div className="flex gap-2">
          {["Write", "List", "Vote"].map((value) => (
            <Button
              key={value}
              size="sm"
              variant={kind === value ? "secondary" : "ghost"}
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {use === "choices"
          ? "Each selected pile becomes a vote option."
          : use === "parts"
            ? "Each selected pile labels a separate answer field."
            : "Selected piles provide background for the question, whichever answer format you choose."}
      </p>
      <Screen name="Participant screen">
        <QuestionCard
          key={`${use}-${kind}`}
          readOnly
          question={{
            question: "carry-example",
            prompt:
              use === "choices"
                ? "Which problem should we tackle?"
                : use === "parts"
                  ? "How could we prevent each problem?"
                  : kind === "Vote"
                    ? "Which approach should we try first?"
                    : "How could we prevent these problems?",
            choices:
              use === "choices"
                ? groups.map((group) => group.name)
                : use === "context" && kind === "Vote"
                  ? ["Improve recovery", "Prevent interruptions"]
                  : [],
            parts:
              use === "parts"
                ? groups.map((group) => group.name)
                : use === "context" && kind === "List"
                  ? ["Suggested improvement"]
                  : [],
            cap: use === "context" && kind === "List" ? 3 : 0,
            position: 1,
            contextUse: use,
            context: groups,
          }}
          answers={{}}
          onAnswer={() => undefined}
          onDraft={() => undefined}
        />
      </Screen>
    </div>
  );
}

/** Local example data and real visual primitives; none of these controls run an activity. */
export function RelayWalkthrough() {
  const [current, setCurrent] = useState(0);
  const lost = [
    "My notes disappeared when the page reloaded.",
    "I closed the tab and lost my draft.",
  ];
  const steps = [
    {
      title: "Launch from the editor",
      caption:
        "When the rounds are ready, click Launch. This opens the host dashboard; it does not collect answers yet.",
      visual: (
        <Screen name="Relay editor">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-display text-xl font-semibold">
              Everyday frustrations
            </h4>
            <Action>
              <Button size="sm" asChild>
                <span>Launch</span>
              </Button>
            </Action>
          </div>
          <div className="rounded-xl border p-4">
            <RoundToken number={1} title="What went wrong?" size="sm" />
            <p className="mt-3 text-sm">
              Describe a frustrating situation you experienced this week.
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <RoundToken number={2} title="Explore the problem" size="sm" />
            <p className="mt-3 text-sm">How could we prevent this problem?</p>
          </div>
        </Screen>
      ),
    },
    {
      title: "Open the shared display",
      caption:
        "Click Project on your dashboard, then share that display with the room. Keep the dashboard on your own screen to run the activity.",
      visual: (
        <Screen name="Host dashboard">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-display text-xl font-semibold">
              Everyday frustrations
            </h4>
            <Action>
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Presentation className="size-4" />
                  Project
                </span>
              </Button>
            </Action>
          </div>
        </Screen>
      ),
    },
    {
      title: "Let the room join from the projected screen",
      caption:
        "Participants scan the QR code with their phone or enter the six-character code at the joining address. They keep the same join link for every round. You can also share the join link directly from the dashboard.",
      visual: (
        <Screen name="Projected screen">
          <div className="flex min-h-44 flex-col items-center justify-center gap-4 text-center">
            <h4 className="font-display text-2xl font-semibold">
              Everyday frustrations
            </h4>
            <p className="text-sm text-muted-foreground">Join on your device</p>
            <div className="flex flex-wrap items-center justify-center gap-5">
              <div
                role="img"
                aria-label="Example joining QR code"
                className="w-28 rounded-lg bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: QR SVG generated locally from a fixed example address.
                dangerouslySetInnerHTML={{
                  __html: renderSVG("https://example.com/join/ABCDEF", {
                    ecc: "M",
                    border: 2,
                  }),
                }}
              />
              <div>
                <p className="font-mono text-3xl tracking-widest">ABCDEF</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  example.com/join
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Example join code</p>
          </div>
        </Screen>
      ),
    },
    {
      title: "Open the round and collect answers",
      caption:
        "Click Open on the host dashboard. Participants see the question and submit their own responses.",
      visual: (
        <>
          <Screen name="Host dashboard">
            <div className="flex items-center justify-between gap-3">
              <div className="w-full">
                <Action>
                  <Button size="lg" className="w-full justify-start" asChild>
                    <span>
                      Open{" "}
                      <RoundToken
                        number={1}
                        title="What went wrong?"
                        size="sm"
                        className="text-current [&>span:first-child]:border-solid [&>span:first-child]:border-current [&>span:first-child]:text-current"
                      />
                    </span>
                  </Button>
                </Action>
              </div>
            </div>
          </Screen>
          <Screen name="Participant screen">
            <RoundToken number={1} title="What went wrong?" size="sm" />
            <QuestionCard
              readOnly
              question={{
                question: "walkthrough-write",
                prompt:
                  "Describe a frustrating situation you experienced this week.",
                choices: [],
                parts: [],
                cap: 0,
                position: 1,
              }}
              answers={{ "walkthrough-write": lost[0] ?? "" }}
              onAnswer={() => undefined}
              onDraft={() => undefined}
            />
          </Screen>
        </>
      ),
    },
    {
      title: "Group responses on the wall",
      caption:
        "New responses arrive in the unsorted tray. Move them into piles by hand, or enable Sort automatically. Try moving the response from the example tray.",
      visual: <SortingExample />,
    },
    {
      title: "Close the round, then choose piles",
      caption:
        "After closing the round, use Top, All, or By hand to choose what continues. Here Lost work is selected. A vote does not automatically advance its winner. If you select an option that received no votes, participants see its name in the next round, but no original responses.",
      visual: (
        <Screen name="Host dashboard">
          <RoundToken number={2} title="Explore the problem" size="sm" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <span>Top</span>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <span>All</span>
            </Button>
            <Action>
              <Button size="sm" asChild>
                <span>By hand</span>
              </Button>
            </Action>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Pile name="Lost work" cards={lost} picked />
            <Pile
              name="Slow sign-in"
              cards={["The login code arrived after it expired."]}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            1 pile selected for round 2
          </p>
        </Screen>
      ),
    },
    {
      title: "The next question uses that selection",
      caption:
        "Open the next round when its input is ready. Participants see the selected pile names and can inspect their supporting responses. Unselected piles do not appear.",
      visual: (
        <Screen name="Participant screen">
          <RoundToken number={2} title="Explore the problem" size="sm" />
          <QuestionCard
            readOnly
            question={{
              question: "walkthrough-vote",
              prompt: "How could we prevent this problem?",
              choices: [],
              parts: [],
              cap: 0,
              position: 1,
              contextUse: "context",
              context: [{ name: "Lost work", cards: lost }],
            }}
            answers={{}}
            onAnswer={() => undefined}
            onDraft={() => undefined}
          />
        </Screen>
      ),
    },
    {
      title: "Choose how earlier work appears",
      caption:
        "In the editor, Takes from selects the source round. The as setting determines how its selected piles appear. Try each example above; these are different ways to use the same earlier work.",
      visual: <CarryExample />,
    },
  ];
  return (
    <div className="space-y-4">
      <div aria-live="polite" className="space-y-4">
        <div className="flex items-center justify-between gap-3 pr-6">
          <span className="font-display font-semibold">How it works</span>
          <p className="text-xs text-muted-foreground">
            Step {current + 1} of {steps.length}
          </p>
        </div>
        <h3 className="text-xl font-semibold">{steps[current]?.title}</h3>
        {steps[current]?.visual}
        <p className="text-sm leading-relaxed">{steps[current]?.caption}</p>
      </div>
      <div className="flex justify-between gap-3 pt-2">
        <Button
          variant="outline"
          disabled={current === 0}
          onClick={() => setCurrent(current - 1)}
        >
          Back
        </Button>
        <Button
          variant="outline"
          disabled={current === steps.length - 1}
          onClick={() => setCurrent(current + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
