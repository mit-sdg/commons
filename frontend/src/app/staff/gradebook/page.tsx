"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import {
  copiesShown,
  differentLetters,
} from "@/components/lms/course-grades/class-helpers";
import { ClassPane } from "@/components/lms/course-grades/class-pane";
import { FINAL_HINT } from "@/components/lms/course-grades/policy-header";
import { PolicyPane } from "@/components/lms/course-grades/policy-pane";
import type {
  Comparison,
  OpenPolicy,
  SaveConflict,
} from "@/components/lms/course-grades/types";
import { PageContainer, PageHeader } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineHelp } from "@/components/ui/inline-help";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/lib/auth";
import { useCourse } from "@/lib/course";
import {
  type CourseGradesPage,
  type CoursePolicy,
  changesBetween,
  courseGradeActions as courseActions,
  courseGrades,
  differsIn,
  loadCourseGradesPage,
  loadPolicy,
  loadVersion,
  SHOW_AS,
  type ShowAs,
  startingPolicy,
} from "@/lib/course-grades";
import { downloadCsv, fileSlug } from "@/lib/csv";

const NEW_POLICY: OpenPolicy = {
  policy: null,
  name: "Course guide",
  version: null,
  authorName: null,
  savedAt: null,
  final: false,
};

/** What the open policy is compared with: "saved", "released", or "policy:<id>". */
type CompareWith = string | null;

export default function CourseGradesPageRoute() {
  const { session, permissions } = useAuth();
  // A learner's assessments are on Assessments, so a learner link opens there.
  const router = useRouter();
  useEffect(() => {
    const search = window.location.search;
    if (new URLSearchParams(search).has("learner"))
      router.replace(`/staff/gradebook/assessments${search}`);
  }, [router]);
  const query = useQuery(session ? () => loadCourseGradesPage() : null, [
    session,
  ]);
  const page = query.data ?? null;
  // The final policy opens first, else the first policy, else a new one.
  const firstPolicy =
    page?.policies.find((entry) => entry.final)?.policy ??
    page?.policies[0]?.policy ??
    null;
  const first = useQuery(firstPolicy ? () => loadPolicy(firstPolicy) : null, [
    firstPolicy,
  ]);

  if ((query.loading && !page) || (firstPolicy && !first.data && !first.error))
    return (
      <PageContainer>
        <LoadingState label="Loading course grades…" />
      </PageContainer>
    );
  if (query.error || !page)
    return (
      <PageContainer>
        <ErrorState
          message={query.error ?? "Course grades are unavailable."}
          refused={query.refused}
          onRetry={query.refetch}
        />
      </PageContainer>
    );
  return (
    <CourseGrades
      key={firstPolicy ?? "new"}
      page={page}
      first={
        firstPolicy && first.data ? { id: firstPolicy, ...first.data } : null
      }
      readOnly={!permissions.can("grade-policies")}
      refetch={query.refetch}
    />
  );
}

type LoadedPolicy = Awaited<ReturnType<typeof loadPolicy>> & { id: string };

function openOf(page: CourseGradesPage, loaded: LoadedPolicy): OpenPolicy {
  return {
    policy: loaded.id,
    name: loaded.name,
    version: loaded.version,
    authorName: loaded.authorName ?? null,
    savedAt: String(loaded.savedAt),
    final: loaded.final,
  };
}

function CourseGrades({
  page,
  first,
  readOnly,
  refetch,
}: {
  page: CourseGradesPage;
  first: LoadedPolicy | null;
  readOnly: boolean;
  refetch: () => void;
}) {
  const inputs = page.inputs;
  const course = useCourse();
  const [open, setOpen] = useState<OpenPolicy>(() =>
    first ? openOf(page, first) : NEW_POLICY,
  );
  const [saved, setSaved] = useState<CoursePolicy | null>(
    first?.specification ?? null,
  );
  const [policy, setPolicy] = useState<CoursePolicy>(
    () => first?.specification ?? startingPolicy(inputs),
  );
  const [conflict, setConflict] = useState<SaveConflict | null>(null);
  const [chosenCompare, setCompareWith] = useState<CompareWith>(null);
  const [showAs, setShowAs] = useState<ShowAs>("letters");

  async function openPolicy(id: string) {
    const loaded = await loadPolicy(id);
    setOpen(openOf(page, { ...loaded, id }));
    setSaved(loaded.specification);
    setPolicy(loaded.specification);
    setConflict(null);
  }

  const dirty =
    saved === null || JSON.stringify(saved) !== JSON.stringify(policy);

  // The policy compared with: this one as saved while it has unsaved edits,
  // what students see, or another saved policy.
  const latestRelease = page.releases.find((entry) => entry.open) ?? null;
  const others = page.policies.filter((entry) => entry.policy !== open.policy);
  const savedChoice = open.policy !== null && dirty && saved !== null;
  const compareWith: CompareWith =
    chosenCompare === "saved"
      ? savedChoice
        ? "saved"
        : null
      : chosenCompare === "released"
        ? latestRelease
          ? "released"
          : null
        : others.some((entry) => `policy:${entry.policy}` === chosenCompare)
          ? chosenCompare
          : null;
  const otherPolicy = compareWith?.startsWith("policy:")
    ? compareWith.slice("policy:".length)
    : null;
  const compared = useQuery(
    otherPolicy ? () => loadPolicy(otherPolicy) : null,
    [otherPolicy],
  );
  const comparePolicy: CoursePolicy | null = otherPolicy
    ? (compared.data?.specification ?? null)
    : compareWith === "saved"
      ? saved
      : compareWith === "released" && latestRelease?.release
        ? (latestRelease.release.policy.specification as CoursePolicy)
        : null;

  const [now] = useState(() => new Date());
  const grades = useMemo(
    () => courseGrades(policy, inputs, now, now),
    [policy, inputs, now],
  );
  const comparison: Comparison | null = useMemo(() => {
    if (!comparePolicy || compareWith === null) return null;
    const name = otherPolicy
      ? (page.policies.find((entry) => entry.policy === otherPolicy)?.name ??
        "")
      : compareWith === "saved"
        ? `${open.name}, saved`
        : "What students see";
    // What students see is each student's released copy, not a recalculation.
    const released = compareWith === "released" && latestRelease;
    return {
      name,
      policy: comparePolicy,
      grades: released ? [] : courseGrades(comparePolicy, inputs, now, now),
      copies: released ? copiesShown(page, released) : null,
      differsIn: differsIn(policy, comparePolicy),
    };
  }, [
    comparePolicy,
    compareWith,
    otherPolicy,
    latestRelease,
    policy,
    inputs,
    now,
    open.name,
    page,
  ]);

  // While editing, Saved carries a live count of the students who change letter.
  const savedGrades = useMemo(
    () => (savedChoice && saved ? courseGrades(saved, inputs, now, now) : null),
    [savedChoice, saved, inputs, now],
  );
  const compareOptions = [
    ...(savedChoice
      ? [
          {
            key: "saved",
            name: "Saved",
            count: savedGrades
              ? differentLetters(grades, savedGrades).size
              : null,
          },
        ]
      : []),
    ...(latestRelease
      ? [{ key: "released", name: "What students see", count: null }]
      : []),
    ...others.map((entry) => ({
      key: `policy:${entry.policy}`,
      name: entry.name,
      count: null,
    })),
  ];
  const finalPolicy = page.policies.find((entry) => entry.final) ?? null;

  // Leaving a policy with unsaved changes asks first.
  const [pendingLeave, setPendingLeave] = useState<
    (() => void | Promise<void>) | null
  >(null);
  function leave(go: () => void | Promise<void>) {
    if (dirty && !readOnly) setPendingLeave(() => go);
    else void go();
  }

  // Leaving the page asks too: an in-app link opens the same dialog, and
  // closing or reloading the tab gets the browser's own prompt.
  const router = useRouter();
  const guarded = dirty && !readOnly;
  useEffect(() => {
    if (!guarded) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const guardLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.hasAttribute("download")) return;
      if (link.target && link.target !== "_self") return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      const href = `${destination.pathname}${destination.search}${destination.hash}`;
      setPendingLeave(() => () => router.push(href));
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLink, true);
    };
  }, [guarded, router]);

  async function save() {
    if (open.policy === null || open.version === null) {
      const created = await courseActions.create(open.name, policy);
      if (!created.ok) return void toast.error(created.error);
      refetch();
      return openPolicy(created.value.policy);
    }
    const result = await courseActions.save(open.policy, open.version, policy);
    if (result.ok) {
      refetch();
      return openPolicy(open.policy);
    }
    if (result.code !== "CONFLICT") return void toast.error(result.error);
    const [current, loaded] = await Promise.all([
      loadPolicy(open.policy),
      loadVersion(open.policy, open.version),
    ]);
    setConflict({
      authorName: current.authorName ?? "Someone",
      savedAt: String(current.savedAt),
      version: current.version,
      changes: changesBetween(loaded.specification, current.specification),
    });
    refetch();
  }

  async function saveCopy(name: string) {
    const created = await courseActions.create(name, policy);
    if (!created.ok) return void toast.error(created.error);
    refetch();
    await openPolicy(created.value.policy);
  }

  async function act(
    run: () => Promise<{ ok: boolean; error?: string }>,
    after?: () => void,
  ) {
    const result = await run();
    if (!result.ok) return void toast.error(result.error);
    after?.();
    refetch();
  }

  async function download() {
    const result = await courseActions.exportCsv();
    if (!result.ok) return void toast.error(result.error);
    downloadCsv(
      `${fileSlug(course.code || course.title, "class")}-course-grades.csv`,
      result.value.csv,
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Staff"
        title="Course grades"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {readOnly && <Badge variant="secondary">View only</Badge>}
            <select
              aria-label="Show as"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={showAs}
              onChange={(event) => setShowAs(event.target.value as ShowAs)}
            >
              {SHOW_AS.map((option) => (
                <option key={option.value} value={option.value}>
                  Show as: {option.label}
                </option>
              ))}
            </select>
            <InlineHelp label="Show as">
              Changes only how this screen shows grades. Download uses the final
              policy&apos;s letters.
            </InlineHelp>
            {!readOnly && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={finalPolicy === null}
                  onClick={download}
                >
                  <Download className="size-4" /> Download final grades
                </Button>
                <InlineHelp label="About Download">
                  {finalPolicy
                    ? `A CSV of each student's grade under ${finalPolicy.name}, the final policy, as last saved. Unsaved edits are not in it.`
                    : `No policy is final yet. ${FINAL_HINT}`}
                </InlineHelp>
              </>
            )}
          </div>
        }
      />
      <ConfirmAction
        open={pendingLeave !== null}
        onOpenChange={(next) => {
          if (!next) setPendingLeave(null);
        }}
        title="Discard unsaved changes?"
        description={`Changes to ${open.name} aren't saved.`}
        confirmLabel="Discard"
        destructive
        onConfirm={async () => {
          await pendingLeave?.();
          setPendingLeave(null);
        }}
      />
      <div className="mt-4 grid gap-6 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="order-2 lg:order-1">
          <PolicyPane
            key={open.policy ?? "new"}
            inputs={inputs}
            policy={policy}
            saved={saved}
            onChange={setPolicy}
            open={open}
            policies={page.policies}
            dirty={dirty}
            readOnly={readOnly}
            conflict={conflict}
            onOpenPolicy={(id) => leave(() => openPolicy(id))}
            onNewPolicy={() =>
              leave(() => {
                setOpen(NEW_POLICY);
                setSaved(null);
                setPolicy(startingPolicy(inputs));
                setConflict(null);
              })
            }
            onSave={save}
            onSaveCopy={saveCopy}
            onReload={async () => {
              if (open.policy) await openPolicy(open.policy);
            }}
            onRename={(name) =>
              open.policy
                ? act(
                    () => courseActions.rename(open.policy!, name),
                    () => setOpen({ ...open, name }),
                  )
                : Promise.resolve(setOpen({ ...open, name }))
            }
            onRemove={() =>
              open.policy
                ? act(
                    () => courseActions.remove(open.policy!),
                    () => {
                      setOpen(NEW_POLICY);
                      setSaved(null);
                      setPolicy(startingPolicy(inputs));
                    },
                  )
                : Promise.resolve()
            }
            onMarkFinal={() =>
              open.policy
                ? act(
                    () => courseActions.markFinal(open.policy!),
                    () => setOpen({ ...open, final: true }),
                  )
                : Promise.resolve()
            }
          />
        </div>
        <div className="order-1 min-w-0 lg:order-2">
          <ClassPane
            inputs={inputs}
            policy={policy}
            onChange={setPolicy}
            grades={grades}
            comparison={comparison}
            compare={{
              options: compareOptions,
              selected: compareWith,
              onSelect: setCompareWith,
            }}
            showAs={showAs}
            sections={page.sections}
            readOnly={readOnly}
            savedPolicy={open.policy}
            onChanged={refetch}
          />
        </div>
      </div>
    </PageContainer>
  );
}
