"use client";

import { Eye, EyeOff } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SwitchRow } from "@/components/ui/switch";
import type { Grader } from "@/lib/grade-analysis";
import { cn } from "@/lib/utils";
import { RING } from "./common";

export interface Naming {
  mine: (grader: string | null) => boolean;
  grader: (grader: string | null, form?: "short" | "long") => string;
  student: (paper: { name: string }) => string | null;
}

function chipNames(graders: readonly Grader[]): Map<string, string> {
  const forms = [
    (name: string) =>
      name
        .split(/\s+/)
        .map((word) => word[0])
        .join(""),
    (name: string) => name.split(/\s+/)[0] ?? name,
    (name: string) => name,
  ];
  for (const form of forms) {
    const said = graders.map((grader) => form(grader.name));
    if (new Set(said).size === said.length || form === forms.at(-1))
      return new Map(
        graders.map((grader, index) => [grader.grader, said[index] as string]),
      );
  }
  return new Map();
}

export function naming(
  graders: readonly Grader[],
  viewer: string | null,
  graderNames: boolean,
  studentNames: boolean,
): Naming {
  const byId = new Map(graders.map((grader) => [grader.grader, grader]));
  const chips = chipNames(graders);
  return {
    mine: (grader) => grader !== null && grader === viewer,
    grader(id, form = "long") {
      const grader = id === null ? undefined : byId.get(id);
      if (!grader) return form === "short" ? "–" : "Without a grader";
      if (form === "short")
        return graderNames
          ? (chips.get(grader.grader) ?? grader.name)
          : grader.letter;
      const said = graderNames ? grader.name : `Grader ${grader.letter}`;
      return id === viewer ? `${said} (you)` : said;
    },
    student: (paper) => (studentNames ? paper.name : null),
  };
}

export function NamesButton({
  graderNames,
  studentNames,
  onGraderNames,
  onStudentNames,
}: {
  graderNames: boolean;
  studentNames: boolean;
  onGraderNames: (on: boolean) => void;
  onStudentNames: (on: boolean) => void;
}) {
  const shown = graderNames || studentNames;
  const said =
    graderNames && studentNames
      ? "Names shown"
      : graderNames
        ? "Grader names"
        : studentNames
          ? "Student names"
          : "Anonymous";
  const Icon = shown ? Eye : EyeOff;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm",
            shown
              ? "bg-foreground font-medium text-background"
              : "text-muted-foreground hover:bg-muted",
            RING,
          )}
        >
          <Icon aria-hidden className="size-4" />
          {said}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-56 gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Show names
        </span>
        <SwitchRow label="Graders" on={graderNames} onChange={onGraderNames} />
        <SwitchRow
          label="Students"
          on={studentNames}
          onChange={onStudentNames}
        />
      </PopoverContent>
    </Popover>
  );
}
