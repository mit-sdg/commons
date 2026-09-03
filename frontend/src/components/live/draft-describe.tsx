"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLE =
  "A five-question multiple-choice quiz on photosynthesis for an intro biology lecture — one right answer each, with a short explanation of why it is right.";

/**
 * The opening of the drafting line: one plain-language request, in the
 * author's own words. Everything the reasoner writes descends from what is
 * typed here, so the box is large and the example shows the grain of a
 * request that drafts well.
 */
export function DraftDescribe({
  submitting,
  onSubmit,
  title = "Describe the quiz or survey you want",
  placeholder = EXAMPLE,
  label = "Draft it",
}: {
  submitting: boolean;
  onSubmit: (request: string) => void;
  /** What is being described, and the example that shows its grain. */
  title?: string;
  placeholder?: string;
  label?: string;
}) {
  const [request, setRequest] = useState("");
  const ready = request.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="draft-request">Your description</Label>
          <Textarea
            id="draft-request"
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            placeholder={placeholder}
            rows={6}
            className="min-h-40 resize-y"
          />
        </div>

        <Button
          onClick={() => {
            if (ready && !submitting) onSubmit(request.trim());
          }}
          disabled={!ready || submitting}
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {label}
        </Button>
      </CardContent>
    </Card>
  );
}
