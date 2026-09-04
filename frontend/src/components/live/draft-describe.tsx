"use client";

import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { BriefChips } from "@/components/live/brief-chips";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * The opening of the drafting line: one plain-language request, in the
 * author's own words. Everything the reasoner writes descends from what is
 * typed here, so the box is large, and the chips under it are briefs the
 * author can start from.
 */
export function DraftDescribe({
  submitting,
  onSubmit,
  placeholder,
  chips = [],
  label = "Draft",
}: {
  submitting: boolean;
  onSubmit: (request: string) => void;
  placeholder: string;
  /** Briefs offered under the box; tapping one replaces what is written. */
  chips?: readonly string[];
  label?: string;
}) {
  const [request, setRequest] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const ready = request.trim().length > 0;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="draft-request">Your description</Label>
          <Textarea
            id="draft-request"
            ref={box}
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            placeholder={placeholder}
            rows={6}
            className="min-h-40 resize-y"
          />
          <BriefChips
            chips={chips}
            className="pt-1"
            onPick={(chip) => {
              setRequest(chip);
              box.current?.focus();
            }}
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
