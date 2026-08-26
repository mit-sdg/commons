"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import {
  DISCLOSURE_OPTIONS,
  type Disclosure,
  isDisclosure,
  isQuizForm,
  type QuizForm,
} from "@/components/live/quiz-meta";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, isApiError, publicErrorMessage } from "@/lib/api";

function NewQuestionnaireContent() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [form, setForm] = useState<QuizForm>("quiz");
  const [disclosure, setDisclosure] = useState<Disclosure>("score");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const trimmed = title.trim();
    const result = await api["/live/quizzes/create"]({
      // An untitled questionnaire gets its name from the composition's default.
      title: trimmed === "" ? undefined : trimmed,
      form,
      disclosure,
    });
    if (isApiError(result)) {
      setBusy(false);
      toast.error(publicErrorMessage(result.error));
      return;
    }
    // Straight to the desk where the questions get written.
    router.push(`/staff/live/${result.questionnaire}`);
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        eyebrow={
          <Link
            href="/staff/live"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Live
          </Link>
        }
        title="New quiz or survey"
      />

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="live-title">Title</Label>
          <Input
            id="live-title"
            value={title}
            disabled={busy}
            placeholder="e.g. Lecture 7 check-in"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="live-form">Form</Label>
          <Select
            value={form}
            disabled={busy}
            onValueChange={(value) => {
              if (isQuizForm(value)) setForm(value);
            }}
          >
            <SelectTrigger id="live-form" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quiz">Quiz</SelectItem>
              <SelectItem value="survey">Survey</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {form === "quiz" ? (
          <div className="space-y-2">
            <Label htmlFor="live-disclosure">
              What participants see afterward
            </Label>
            <Select
              value={disclosure}
              disabled={busy}
              onValueChange={(value) => {
                if (isDisclosure(value)) setDisclosure(value);
              }}
            >
              <SelectTrigger id="live-disclosure" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISCLOSURE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Button disabled={busy} onClick={() => void create()}>
            {busy ? "Creating…" : "Create"}
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/staff/live">Cancel</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

export default function NewQuestionnairePage() {
  return (
    <RequireCapability capability="live:host">
      <NewQuestionnaireContent />
    </RequireCapability>
  );
}
