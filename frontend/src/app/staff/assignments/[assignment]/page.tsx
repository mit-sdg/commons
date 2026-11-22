"use client";

import { AlertTriangle, Archive, Eye, Send } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  memo,
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Fact, Facts } from "@/components/facts";
import { RenderedMarkdown } from "@/components/forum/rendered-markdown";
import { AssignmentForm } from "@/components/lms/assignment-form";
import {
  AssignmentDates,
  AssignmentInstructions,
  AssignmentSkills,
} from "@/components/lms/assignment-reading";
import { EarlierSubmissionsBar } from "@/components/lms/earlier-submissions-bar";
import { AssessmentInput } from "@/components/lms/grade-input";
import { GradeSetup } from "@/components/lms/grade-setup";
import { GradesTab, type GradesView } from "@/components/lms/grades/tab";
import { GradingDataNotice } from "@/components/lms/grading-data-notice";
import {
  type GraderFilter,
  GraderSelect,
  GradingDelegationToolbar,
} from "@/components/lms/grading-delegation";
import { StatusBadge } from "@/components/lms/status-badge";
import { BackLink, PageContainer } from "@/components/page";
import { PageTitle } from "@/components/page-title";
import { RequireCapability } from "@/components/require-capability";
import { ErrorState, LoadingState } from "@/components/states";
import { TaskMarkdown } from "@/components/tasks/task-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import {
  api,
  publicErrorMessage,
  requestErrorMessage,
  unwrap,
} from "@/lib/api";
import { assignmentTypeLabel } from "@/lib/assignment-types";
import { useAuth } from "@/lib/auth";
import { useCourse } from "@/lib/course";
import {
  ALL_GRADERS,
  learnerMatchesGraderFilter,
} from "@/lib/delegation-filter";
import { count, dueTime, fromZonedInput, toZonedInput } from "@/lib/format";
import { analyzeGrades, learnerState } from "@/lib/grade-analysis";
import type { Assessment, GradingSetup } from "@/lib/grading";
import {
  loadDelegationForItem,
  loadDelegationGraders,
  loadGradesForItem,
  loadLateDaysForAssignment,
  loadSections,
  loadSubmissionAttempts,
  loadSubmissionsForAssignment,
} from "@/lib/lms";
import {
  downloadSubmissionsCsv,
  type ItemAssessment,
  type LearnerAttempt,
  selectExportAssessment,
  selectSubmissionAttempt,
} from "@/lib/submissions-export";
import {
  draftsThatDiffer,
  earlierSubmissions,
  releaseReach,
  type SubmitterRow,
  submitterRows,
} from "@/lib/submitter-rows";
import { submittedByTeam } from "@/lib/teams";

/** The evidence menu needs a value for "no attempt"; a submission id never looks like this. */
const EXCUSAL = "excusal";

const listed = new Intl.ListFormat("en", { type: "conjunction" });

function gradeSaid(grade: ItemAssessment): string | null {
  return grade.method === "POINTS" && grade.scored
    ? `${grade.score} / ${grade.outOf}`
    : null;
}

/** Two or more drafts on one row that disagree, with their scores where they have them. */
function differingSaid(drafts: readonly ItemAssessment[]): string {
  const scores = drafts.map(gradeSaid);
  return scores.every((score) => score !== null)
    ? `Draft grades differ: ${listed.format(scores as string[])}`
    : "Draft grades differ";
}

/** What releasing every draft reaches on an assignment each team submits. */
function teamReleaseSaid(
  rows: readonly SubmitterRow[],
  grades: readonly ItemAssessment[],
  submissions: readonly LearnerAttempt[],
): string {
  const reach = releaseReach(rows, grades);
  const differing = rows
    .map((row) => draftsThatDiffer(grades, String(row.assignee)).length)
    .filter((drafts) => drafts > 0);
  const reached = `${count(reach.drafts, "draft")}${reach.teams > 0 ? ` on ${count(reach.teams, "team")}` : ""} ${reach.drafts === 1 ? "becomes" : "become"} visible to ${count(reach.students, "student")}.`;
  const differ =
    reach.differing.length === 0
      ? ""
      : ` ${listed.format(reach.differing)} ${reach.differing.length === 1 ? "has" : "have"} draft grades that differ, and ${differing.length === 1 && differing[0] === 2 ? "both" : "all"} would be released.`;
  const ungraded = rows
    .filter((row) => {
      const id = String(row.assignee);
      const own = grades.filter((grade) => String(grade.learner) === id);
      return (
        own.some((grade) => grade.status === "DRAFT") &&
        learnerState(
          submissions.filter((attempt) => String(attempt.submitter) === id),
          own,
        )?.state === "new-attempt"
      );
    })
    .map((row) => row.displayName ?? String(row.assignee));
  const later =
    ungraded.length === 0
      ? ""
      : ` ${listed.format(ungraded)} ${ungraded.length === 1 ? "has" : "have"} a later attempt with no grade.`;
  return `${reached}${differ}${later} Incomplete or concurrently changed drafts are skipped and reported.`;
}

/**
 * Submissions holds one card per learner, so it mounts the first time it is
 * shown and, while another tab shows, keeps its state without re-rendering.
 */
const WhileShown = memo(
  function WhileShown({
    shown,
    children,
  }: {
    shown: boolean;
    children: ReactNode;
  }) {
    const [seen, setSeen] = useState(shown);
    if (shown && !seen) setSeen(true);
    return seen || shown ? children : null;
  },
  (_, next) => !next.shown,
);

function DueDateOverride({
  assignment,
  assignee,
  learnerName,
  team = false,
  courseDueAt,
  currentDueAt,
  onUpdate,
}: {
  assignment: string;
  /** The student the request names; on a team, any member sets the team's date. */
  assignee: string;
  learnerName: string;
  team?: boolean;
  courseDueAt: string;
  currentDueAt: string | null;
  onUpdate: () => void;
}) {
  const { timezone } = useCourse();
  const [dueAt, setDueAt] = useState(
    toZonedInput(currentDueAt ?? courseDueAt, timezone),
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await api.assignments["set-due-override"]({
      assignment,
      assignee,
      dueAt: fromZonedInput(dueAt, timezone),
    });
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(`Due date updated for ${learnerName}`);
      onUpdate();
    }
  }

  async function clear() {
    setBusy(true);
    const result = await api.assignments["clear-due-override"]({
      assignment,
      assignee,
    });
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(`Course due date restored for ${learnerName}`);
      setDueAt(toZonedInput(courseDueAt, timezone));
      onUpdate();
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label
          htmlFor={`due-override-${assignee}`}
          className="text-xs text-muted-foreground"
        >
          {team ? "Team due date" : "Individual due date"} ({timezone})
        </Label>
        <Input
          id={`due-override-${assignee}`}
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          className="w-auto"
          disabled={busy}
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={save}
        disabled={busy || !dueAt}
      >
        Save due date
      </Button>
      {currentDueAt ? (
        <Button size="sm" variant="ghost" onClick={clear} disabled={busy}>
          Use course date
        </Button>
      ) : null}
    </div>
  );
}

function StaffAssignmentDetailPageContent({
  params,
}: {
  params: Promise<{ assignment: string }>;
}) {
  const { assignment } = use(params);
  const router = useRouter();
  const { session, me, permissions } = useAuth();
  const canManage = permissions.can("course:manage");
  const canGrade = permissions.can("grade");
  const canReadStudentRecords = permissions.can("student-records");
  const [editing, setEditing] = useState(false);
  const [gradingUser, setGradingUser] = useState<string | null>(null);
  const [gradingEvidence, setGradingEvidence] = useState<string | null>(null);
  const [gradingDirty, setGradingDirty] = useState(false);
  const [setupDirty, setSetupDirty] = useState(false);
  const [pendingGradingTarget, setPendingGradingTarget] = useState<{
    learner: string;
    evidence: string | null;
  } | null>(null);
  const [pendingEdit, setPendingEdit] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const [pendingAttemptHash, setPendingAttemptHash] = useState<string | null>(
    null,
  );
  const [graderFilter, setGraderFilter] = useState<GraderFilter>(ALL_GRADERS);
  const [fromGrades, setFromGrades] = useState<{
    learners: ReadonlySet<string>;
    said: string;
  } | null>(null);
  const [exporting, setExporting] = useState(false);

  const {
    data: asgnData,
    loading,
    error,
    refused,
    refetch,
  } = useQuery(
    session
      ? () => api.assignments["staff-summary"]({ assignment }).then(unwrap)
      : null,
    [session, assignment],
    { retainOnTransportError: true },
  );

  const {
    data: subsData,
    loading: submissionsLoading,
    error: submissionsError,
    refused: submissionsRefused,
    refetch: refetchSubmissions,
    answeredAt: submissionsAnsweredAt,
  } = useQuery(
    session && canGrade ? () => loadSubmissionsForAssignment(assignment) : null,
    [session, assignment],
    { retainOnTransportError: true },
  );

  const submissions = subsData?.submissions ?? [];
  const byTeam = asgnData?.summary ? submittedByTeam(asgnData.summary) : false;
  const { data: sectionsData } = useQuery(
    session && byTeam ? () => loadSections() : null,
    [session, byTeam],
    { retainOnTransportError: true },
  );
  const teamNames = useMemo(
    () =>
      new Map(
        (sectionsData?.sections ?? []).map(
          (section) => [String(section.section), String(section.name)] as const,
        ),
      ),
    [sectionsData],
  );
  /** One row per team on an assignment each team submits, else one per student. */
  const rows = useMemo(
    () => submitterRows(subsData?.assigned ?? [], teamNames, byTeam),
    [subsData, teamNames, byTeam],
  );
  const throughOf = new Map(
    rows.map((row) => [String(row.assignee), row.through] as const),
  );
  const teamWork = rows.filter(
    (row) =>
      row.team &&
      submissions.some(
        (submission) => String(submission.submitter) === String(row.assignee),
      ),
  );
  const { data: authorData } = useQuery<Record<string, string>>(
    teamWork.length > 0
      ? async () => {
          const lists = await Promise.all(
            teamWork.map((row) =>
              loadSubmissionAttempts(assignment, row.through).then(
                (read) => read.attempts,
                () => [],
              ),
            ),
          );
          return Object.fromEntries(
            lists
              .flat()
              .flatMap((attempt) =>
                attempt.authorName
                  ? [[String(attempt.submission), attempt.authorName] as const]
                  : [],
              ),
          );
        }
      : null,
    [assignment],
    {
      refreshOn: [
        teamWork
          .map((row) => `${String(row.assignee)}:${row.through}`)
          .join(" "),
        byTeam ? submissions.map((row) => row.submission).join(" ") : "",
      ],
    },
  );
  const artifactKey = submissions
    .flatMap((submission) => submission.artifacts)
    .join(" ");
  const { data: artifactData } = useQuery<Record<string, string>>(
    submissions.length > 0
      ? async () => {
          const artifacts = submissions.flatMap((submission) =>
            submission.artifacts.map((artifact) => ({
              artifact,
              submitter:
                throughOf.get(String(submission.submitter)) ??
                String(submission.submitter),
            })),
          );
          const entries = await Promise.all(
            artifacts.map(async ({ artifact, submitter }) => {
              const result = await api.submissions.artifact({
                assignment,
                submitter,
                artifact,
              });
              return [
                artifact,
                "error" in result ? "" : (result.post?.rendered ?? ""),
              ] as const;
            }),
          );
          return Object.fromEntries(entries);
        }
      : null,
    [assignment],
    { refreshOn: [artifactKey] },
  );

  const gradesQuery = useQuery(
    session && canGrade ? () => loadGradesForItem(assignment) : null,
    [session, assignment],
    { retainOnTransportError: true },
  );
  const { refetch: refetchGrades } = gradesQuery;

  const {
    data: lateData,
    loading: lateLoading,
    refetch: refetchLateDays,
  } = useQuery(
    session && canReadStudentRecords
      ? () => loadLateDaysForAssignment(assignment)
      : null,
    [session, assignment, canReadStudentRecords],
  );

  const delegationQuery = useQuery(
    session && canGrade ? () => loadDelegationForItem(assignment) : null,
    [session, assignment],
    { retainOnTransportError: true },
  );
  const gradersQuery = useQuery(
    session && canGrade ? () => loadDelegationGraders() : null,
    [session],
    { retainOnTransportError: true },
  );

  const gradingSetup = useQuery(
    session && canGrade
      ? () => api.grades.item({ item: assignment }).then(unwrap)
      : null,
    [session, assignment],
    { retainOnTransportError: true },
  );
  const detail = asgnData?.summary;
  const itemGrades = gradesQuery.data?.grades ?? [];
  const grades = itemGrades as Assessment[];
  const currentSetup = gradingSetup.data as GradingSetup | null;
  const gradingDataReady = Boolean(currentSetup && gradesQuery.data);
  const gradingDataLoading = gradingSetup.loading || gradesQuery.loading;
  const gradingDataError = gradingSetup.error ?? gradesQuery.error ?? null;
  const gradingDataRefused = !gradingSetup.data
    ? gradingSetup.refused
    : gradesQuery.refused;
  const gradingDataUnavailable =
    !gradingDataReady ||
    gradingDataLoading ||
    Boolean(gradingDataError) ||
    submissionsLoading ||
    Boolean(submissionsError);
  const lateUsers = lateData?.users ?? [];
  const draftCount = gradingDataReady
    ? byTeam
      ? releaseReach(rows, itemGrades).drafts
      : grades.filter((record) => record.status === "DRAFT").length
    : 0;

  function refetchGradingData() {
    gradingSetup.refetch();
    refetchGrades();
  }

  /** The tab and the Grades view live in the URL, so Back keeps the place and a link reopens it. */
  function navigate(
    changes: Record<string, string | null>,
    mode: "push" | "replace",
    hash = "",
  ) {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${hash}`;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  function openAssessment(learner: string, evidence: string | null) {
    if (
      gradingDirty &&
      (gradingUser !== learner || gradingEvidence !== evidence)
    ) {
      setPendingGradingTarget({ learner, evidence });
      return;
    }
    setGradingUser(learner);
    setGradingEvidence(evidence);
  }

  useEffect(() => {
    function queueAttempt() {
      setPendingAttemptHash(
        canGrade && window.location.hash.startsWith("#attempt-")
          ? window.location.hash.slice(1)
          : null,
      );
    }
    queueAttempt();
    window.addEventListener("hashchange", queueAttempt);
    return () => {
      window.removeEventListener("hashchange", queueAttempt);
    };
  }, [canGrade]);

  useEffect(() => {
    if (!canGrade || !pendingAttemptHash) return;
    let scrollFrame = 0;
    const revealFrame = requestAnimationFrame(() => {
      const target = document.getElementById(pendingAttemptHash);
      if (!(target instanceof HTMLDetailsElement)) return;
      if (
        new URLSearchParams(window.location.search).get("tab") !== "submissions"
      )
        navigate({ tab: "submissions" }, "replace", window.location.hash);
      target.open = true;
      scrollFrame = requestAnimationFrame(() => {
        target.scrollIntoView();
        setPendingAttemptHash(null);
      });
    });
    return () => {
      cancelAnimationFrame(revealFrame);
      cancelAnimationFrame(scrollFrame);
    };
  }, [canGrade, pendingAttemptHash, loading, subsData, gradingDataReady]);

  const submittedIds = new Set(
    submissions
      .filter((submission) => submission.status === "SUBMITTED")
      .map((submission) => String(submission.submitter)),
  );

  const lateMap = new Map(lateUsers.map((u) => [u.learner, u.days]));

  const graders = gradersQuery.data?.graders ?? [];
  const delegations = delegationQuery.data?.delegations ?? [];
  const delegationByLearner = new Map(
    delegations.map((row) => [String(row.learner), row] as const),
  );
  const byLearner = new Map(
    delegations.map(
      (row) => [String(row.learner), String(row.grader)] as const,
    ),
  );
  const learnerIds = rows.map((learner) => String(learner.assignee));
  const visibleAssigned = rows.filter(
    (learner) =>
      (!fromGrades || fromGrades.learners.has(String(learner.assignee))) &&
      learnerMatchesGraderFilter(
        String(learner.assignee),
        graderFilter,
        byLearner,
        me?.user ?? null,
      ),
  );
  const visibleLearnerIds = visibleAssigned.map((learner) =>
    String(learner.assignee),
  );
  const visibleLearnerSet = new Set(visibleLearnerIds);
  // Keep the open editor mounted even if a filter or grader reassignment hides it.
  // Its draft stays in memory, and refusals still clear the workspace below.
  const workspaceAssigned = rows.filter(
    (learner) =>
      visibleLearnerSet.has(String(learner.assignee)) ||
      String(learner.assignee) === gradingUser,
  );
  const visibleSubmitted = new Set(
    submissions
      .filter(
        (submission) =>
          submission.status === "SUBMITTED" &&
          visibleLearnerSet.has(String(submission.submitter)),
      )
      .map((submission) => String(submission.submitter)),
  ).size;
  const hiddenDraftCount = grades.filter(
    (grade) =>
      grade.status === "DRAFT" && !visibleLearnerSet.has(String(grade.learner)),
  ).length;
  const delegationLoading = delegationQuery.loading || gradersQuery.loading;
  const delegationError = delegationQuery.error ?? gradersQuery.error;
  const refreshing =
    loading ||
    submissionsLoading ||
    gradingSetup.loading ||
    gradesQuery.loading ||
    lateLoading ||
    delegationLoading;

  function refreshSubmissionWorkspace() {
    refetch();
    refetchSubmissions();
    refetchGradingData();
    refetchLateDays();
    delegationQuery.refetch();
    gradersQuery.refetch();
  }

  function refreshGrades() {
    refetchSubmissions();
    refetchGrades();
    delegationQuery.refetch();
  }

  function selectTab(value: string) {
    setPendingAttemptHash(null);
    navigate({ tab: value === "overview" ? null : value }, "push");
    if (value === "preview") gradingSetup.refetch();
  }

  const gradesView: GradesView = {
    byGrader: searchParams.get("by") === "grader",
    criterion: searchParams.get("criterion"),
    grader: searchParams.get("criterion") ? searchParams.get("grader") : null,
  };

  function showGradesView(view: GradesView, mode: "push" | "replace") {
    navigate(
      {
        by: view.byGrader ? "grader" : null,
        criterion: view.criterion,
        grader: view.criterion ? view.grader : null,
      },
      mode,
    );
  }

  function openLearners(learners: string[], said: string) {
    setFromGrades({ learners: new Set(learners), said });
    setGraderFilter(ALL_GRADERS);
    selectTab("submissions");
  }

  function openPaper(submission: string) {
    const learner = submissions.find(
      (attempt) => String(attempt.submission) === submission,
    )?.submitter;
    if (learner && !visibleLearnerSet.has(String(learner))) {
      setFromGrades(null);
      setGraderFilter(ALL_GRADERS);
    }
    navigate({ tab: "submissions" }, "push", `#attempt-${submission}`);
    setPendingAttemptHash(`attempt-${submission}`);
  }

  async function exportCurrentView() {
    if (!session || !me || !detail) return;
    setExporting(true);
    try {
      const [
        freshAssignment,
        freshSubmissions,
        freshDelegations,
        freshGraders,
        observedGrading,
      ] = await Promise.all([
        api.assignments["staff-summary"]({ assignment }).then(unwrap),
        loadSubmissionsForAssignment(assignment),
        loadDelegationForItem(assignment),
        loadDelegationGraders(),
        api.grades.item({ item: assignment }).then(unwrap),
      ]);
      if (!freshAssignment.summary) {
        toast.error(
          "CSV was not downloaded. This assignment is no longer available.",
        );
        return;
      }
      const freshByTeam = submittedByTeam(freshAssignment.summary);
      /** A student's row in scope is their team's on an assignment each team submits. */
      const rowOf = (learner: { assignee: unknown; submitter: unknown }) =>
        String(freshByTeam ? learner.submitter : learner.assignee);
      const freshByLearner = new Map(
        freshDelegations.delegations.map(
          (row) => [String(row.learner), String(row.grader)] as const,
        ),
      );
      const scopedLearners = freshSubmissions.assigned.filter(
        (learner) =>
          (!fromGrades || fromGrades.learners.has(rowOf(learner))) &&
          learnerMatchesGraderFilter(
            rowOf(learner),
            graderFilter,
            freshByLearner,
            me.user,
          ),
      );
      if (scopedLearners.length === 0) {
        toast.info(
          "No learners are in the current scope. No CSV was downloaded.",
        );
        return;
      }

      const [freshSections, freshLateDays, latePolicy, freshGrades] =
        await Promise.all([
          canManage || freshByTeam ? loadSections() : Promise.resolve(null),
          canReadStudentRecords
            ? loadLateDaysForAssignment(assignment)
            : Promise.resolve(null),
          canReadStudentRecords
            ? api["late-days"].policy({}).then(unwrap)
            : Promise.resolve(null),
          loadGradesForItem(assignment),
        ]);
      const confirmedGrading = await api.grades
        .item({ item: assignment })
        .then(unwrap);
      if (confirmedGrading.revision !== observedGrading.revision) {
        toast.info(
          "CSV was not downloaded because the grading setup changed. Try again.",
        );
        return;
      }
      downloadSubmissionsCsv({
        assignment,
        title: freshAssignment.summary.title,
        dueAt: freshAssignment.summary.dueAt,
        submittedBy: freshAssignment.summary.submittedBy,
        assigned: scopedLearners,
        submissions: freshSubmissions.submissions,
        grades: freshGrades.grades,
        grading: {
          method: confirmedGrading.method,
          revision: confirmedGrading.revision,
          maxPoints: confirmedGrading.maxPoints,
        },
        delegations: freshDelegations.delegations,
        graders: freshGraders.graders,
        sectionNames: new Map(
          (freshSections?.sections ?? []).map(
            (section) => [String(section.section), section.name] as const,
          ),
        ),
        lateDays: freshLateDays
          ? new Map(
              freshLateDays.users.map(
                (row) => [String(row.learner), row.days] as const,
              ),
            )
          : null,
        lateDayUnitHours: latePolicy?.unitHours ?? null,
        origin: window.location.origin,
      });
      toast.success(
        `${scopedLearners.length} ${scopedLearners.length === 1 ? "learner" : "learners"} exported`,
      );
    } catch (error) {
      toast.error(`CSV was not downloaded. ${requestErrorMessage(error)}`);
    } finally {
      setExporting(false);
    }
  }

  async function publish() {
    if (!session) return;
    const result = await api.assignments.publish({ assignment });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      await Promise.all([refetch(), refetchSubmissions(), refetchGrades()]);
      toast.success("Assignment published");
    }
  }

  async function archive() {
    if (!session) return;
    const result = await api.assignments.archive({ assignment });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Assignment archived");
      refetch();
    }
  }

  async function releaseAll() {
    if (!session) return;
    if (!currentSetup || gradingDataUnavailable) return;
    try {
      const result = await api.grades["release-item"]({ item: assignment });
      if ("error" in result) toast.error(publicErrorMessage(result.error));
      else {
        const shown = new Set(rows.map((row) => String(row.assignee)));
        const released = byTeam
          ? result.released.filter((entry) => shown.has(String(entry.learner)))
          : result.released;
        const summary = `${released.length} assessments released; ${result.skipped.length} skipped (incomplete or changed).`;
        if (result.unconfirmed.length)
          toast.error(
            `${summary} ${result.unconfirmed.length} outcomes could not be confirmed. Review the refreshed grades before retrying.`,
          );
        else toast.success(summary);
      }
    } catch {
      toast.error(
        "Release outcomes could not be confirmed. Grades were refreshed before retrying.",
      );
    } finally {
      refetchGrades();
    }
  }

  const gradesOnScreen = searchParams.get("tab") === "grades";
  const gradeAnalysis = useMemo(
    () =>
      gradesOnScreen && subsData && gradesQuery.data && delegationQuery.data
        ? analyzeGrades({
            assigned: rows,
            submissions: subsData.submissions,
            grades: gradesQuery.data.grades,
            delegations: delegationQuery.data.delegations,
            graders: gradersQuery.data?.graders ?? [],
          })
        : null,
    [
      gradesOnScreen,
      subsData,
      rows,
      gradesQuery.data,
      delegationQuery.data,
      gradersQuery.data,
    ],
  );

  if (loading && !detail)
    return (
      <PageContainer>
        <LoadingState label="Loading assignment…" />
      </PageContainer>
    );
  if (error && !detail)
    return (
      <PageContainer>
        <ErrorState message={error} refused={refused} onRetry={refetch} />
      </PageContainer>
    );
  if (!detail)
    return (
      <PageContainer>
        <ErrorState message="Assignment not found" />
      </PageContainer>
    );

  const gradesTabShown = canGrade && detail.status !== "DRAFT";
  const requestedTab = searchParams.get("tab") ?? "overview";
  const tab =
    requestedTab === "preview" ||
    ((requestedTab === "submissions" || requestedTab === "grades") &&
      gradesTabShown)
      ? requestedTab
      : "overview";
  const gradesLoadedAt = [
    submissionsAnsweredAt,
    gradesQuery.answeredAt,
    delegationQuery.answeredAt,
  ].reduce<number | null>(
    (oldest, at) =>
      at === null ? oldest : oldest === null ? at : Math.min(oldest, at),
    null,
  );
  const totalAssigned = rows.length;
  const totalSubmitted = byTeam
    ? rows.filter((row) => submittedIds.has(String(row.assignee))).length
    : submittedIds.size;
  const totalMissing = Math.max(0, totalAssigned - totalSubmitted);
  const teamCount = rows.filter((row) => row.team).length;
  const noTeamCount = rows.filter((row) => row.noTeam).length;
  const earlierOf = earlierSubmissions(subsData?.unmoved ?? []).ofTeam;

  if (editing && canManage)
    return (
      <PageContainer>
        <PageTitle parts={["Edit", detail.title, "Assignments", "Staff"]} />
        <div className="mb-6">
          <h1 className="mb-6 font-display text-3xl font-semibold">
            Edit assignment
          </h1>
          <AssignmentForm
            existing={detail}
            onSaved={() => {
              setEditing(false);
              refetch();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      </PageContainer>
    );

  return (
    <PageContainer>
      <BackLink
        href={canManage ? "/staff/assignments" : "/staff/gradebook/assessments"}
        onClick={(event) => {
          if (!setupDirty && !gradingDirty) return;
          event.preventDefault();
          setPendingLeave(
            canManage ? "/staff/assignments" : "/staff/gradebook/assessments",
          );
        }}
      >
        {canManage ? "Back to assignments" : "Back to Assessments"}
      </BackLink>

      <PageTitle parts={[detail.title, "Assignments", "Staff"]} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {detail.title}
            </h1>
            <StatusBadge status={detail.status} />
          </div>
          <Facts className="text-muted-foreground text-sm">
            <Fact.Kind>{assignmentTypeLabel(detail.kind)}</Fact.Kind>
            <Fact.Due verb="Due" at={detail.dueAt} />
            {byTeam ? <span>submitted by each team</span> : null}
          </Facts>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {detail.status !== "ARCHIVED" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (setupDirty || gradingDirty) setPendingEdit(true);
                  else setEditing(true);
                }}
              >
                Edit
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Archived assignments are read-only
              </span>
            )}
            {detail.status === "DRAFT" && (
              <ConfirmAction
                title="Publish this assignment?"
                description={`${detail.audience === "EVERYONE" ? "All active students" : `${detail.targets.length} targeted team${detail.targets.length === 1 ? "" : "s"}`} will receive this assignment. It is available ${dueTime(detail.availableAt)}, due ${dueTime(detail.dueAt)}${detail.closeAt ? `, and closes ${dueTime(detail.closeAt)}` : ""}.`}
                confirmLabel="Publish assignment"
                onConfirm={publish}
                trigger={
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-600"
                  >
                    <Eye className="size-4 mr-1" /> Publish
                  </Button>
                }
              />
            )}
            {detail.status !== "ARCHIVED" ? (
              <ConfirmAction
                title="Archive this assignment?"
                description="Learners will no longer see it in their active assignment list."
                confirmLabel="Archive assignment"
                destructive
                onConfirm={archive}
                trigger={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                  >
                    <Archive className="size-4 mr-1" /> Archive
                  </Button>
                }
              />
            ) : null}
          </div>
        )}
      </div>

      {error ? (
        <div
          role="status"
          className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {error} Assignment details may be out of date.
          </span>
          <Button size="sm" variant="outline" onClick={refetch}>
            Retry details
          </Button>
        </div>
      ) : null}

      <Tabs value={tab} className="gap-6" onValueChange={selectTab}>
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {gradesTabShown && (
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          )}
          {gradesTabShown && <TabsTrigger value="grades">Grades</TabsTrigger>}
          <TabsTrigger value="preview">Student preview</TabsTrigger>
        </TabsList>
        <TabsContent
          value="overview"
          forceMount
          hidden={tab !== "overview"}
          className="space-y-8"
        >
          <section className="space-y-3">
            <h2 className="font-medium">Instructions</h2>
            {detail.instructions ? (
              <TaskMarkdown content={detail.instructions} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No instructions yet.
              </p>
            )}
          </section>
          <section className="space-y-3 border-t pt-6">
            <h2 className="font-medium">Schedule and recipients</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Available from</dt>
                <dd>{dueTime(detail.availableAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Due date</dt>
                <dd>{dueTime(detail.dueAt)}</dd>
              </div>
              {detail.closeAt && (
                <div>
                  <dt className="text-muted-foreground">Closes</dt>
                  <dd>{dueTime(detail.closeAt)}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Assigned to</dt>
                <dd>
                  {detail.audience === "EVERYONE"
                    ? "all students"
                    : `${detail.targets.length} selected teams`}
                </dd>
              </div>
            </dl>
          </section>
          {canGrade && detail.acceptsSubmissions && (
            <GradeSetup
              item={assignment}
              title={detail.title}
              published={detail.status === "PUBLISHED"}
              readOnly={detail.status === "ARCHIVED"}
              onMethodChange={() => {
                refetchGradingData();
              }}
              onDirtyChange={setSetupDirty}
            />
          )}
        </TabsContent>
        <TabsContent
          value="preview"
          forceMount
          hidden={tab !== "preview"}
          className="space-y-4"
        >
          <p className="text-sm text-muted-foreground">
            Assignment content as shown to students. Personal history, late
            days, and deadline overrides are omitted; submission controls are
            inactive.
          </p>
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-4">
              {detail.instructions && (
                <AssignmentInstructions instructions={detail.instructions} />
              )}
              {canGrade && gradingSetup.loading && !gradingSetup.data ? (
                <LoadingState label="Loading grading setup…" />
              ) : canGrade && gradingSetup.error && !gradingSetup.data ? (
                <ErrorState
                  message={gradingSetup.error}
                  refused={gradingSetup.refused}
                  onRetry={gradingSetup.refetch}
                />
              ) : (
                <>
                  {canGrade && gradingSetup.data ? (
                    <GradingDataNotice
                      loading={gradingSetup.loading}
                      error={gradingSetup.error}
                      onRetry={gradingSetup.refetch}
                    />
                  ) : null}
                  {currentSetup ? (
                    <AssignmentSkills criteria={currentSetup.criteria} />
                  ) : null}
                </>
              )}
              {detail.acceptsSubmissions && (
                <Card density="compact">
                  <CardHeader>
                    <CardTitle className="text-base">Submit</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      disabled
                      aria-label="Submission preview"
                      placeholder="Write your submission…"
                      rows={8}
                    />
                    <Button disabled>
                      <Send className="size-4" /> Submit
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
            <aside>
              <AssignmentDates
                availableAt={detail.availableAt}
                dueAt={detail.dueAt}
                closeAt={detail.closeAt}
              />
            </aside>
          </div>
        </TabsContent>
        {gradesTabShown && (
          <TabsContent value="grades" className="space-y-6">
            {gradeAnalysis ? (
              <GradesTab
                analysis={gradeAnalysis}
                viewer={me?.user ?? null}
                view={gradesView}
                onView={showGradesView}
                loadedAt={gradesLoadedAt}
                onRefresh={refreshGrades}
                onOpenLearners={openLearners}
                onOpenPaper={openPaper}
                hasSetup={Boolean(currentSetup?.criteria.length)}
                refreshError={Boolean(
                  submissionsError ??
                    gradesQuery.error ??
                    delegationQuery.error,
                )}
                paperText={(submission) => {
                  const attempt = submissions.find(
                    (entry) => String(entry.submission) === submission,
                  );
                  if (!attempt || !artifactData) return null;
                  return attempt.artifacts.map(
                    (artifact) => artifactData[artifact] ?? "",
                  );
                }}
              />
            ) : (submissionsError && !subsData) ||
              (gradesQuery.error && !gradesQuery.data) ||
              (delegationError && !delegationQuery.data) ? (
              <ErrorState
                message={
                  submissionsError ??
                  gradesQuery.error ??
                  delegationError ??
                  "Grades are unavailable."
                }
                refused={submissionsRefused ?? gradesQuery.refused}
                onRetry={refreshSubmissionWorkspace}
              />
            ) : (
              <LoadingState label="Loading grades…" />
            )}
          </TabsContent>
        )}
        {canGrade && (
          <TabsContent
            value="submissions"
            forceMount
            hidden={tab !== "submissions"}
            className="space-y-6"
          >
            <WhileShown
              shown={tab === "submissions" || pendingAttemptHash !== null}
            >
              <Facts className="text-sm">
                {byTeam ? (
                  <>
                    <Fact.Count n={teamCount} noun="team" />
                    {noTeamCount > 0 ? (
                      <Fact.Count
                        n={noTeamCount}
                        noun="on no team"
                        plural="on no team"
                      />
                    ) : null}
                  </>
                ) : (
                  <Fact.Count
                    n={totalAssigned}
                    noun="assigned"
                    plural="assigned"
                  />
                )}
                <Fact.Count
                  n={totalSubmitted}
                  noun="submitted"
                  plural="submitted"
                />
                <Fact.Count n={totalMissing} noun="missing" plural="missing" />
              </Facts>
              {byTeam && canManage ? (
                <EarlierSubmissionsBar
                  assignment={assignment}
                  unmoved={subsData?.unmoved ?? []}
                  submissions={submissions}
                  onMoved={() => {
                    refetchSubmissions();
                    refetchGrades();
                    delegationQuery.refetch();
                  }}
                />
              ) : null}
              {fromGrades ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-sm tabular-nums">
                    {fromGrades.said}{" "}
                    <span className="text-muted-foreground">from Grades</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setFromGrades(null)}
                  >
                    Clear
                  </Button>
                </div>
              ) : null}
              <GradingDelegationToolbar
                item={assignment}
                filter={graderFilter}
                onFilter={setGraderFilter}
                graders={graders}
                delegations={delegations}
                allLearners={learnerIds}
                visibleLearners={visibleLearnerIds}
                visibleSubmitted={visibleSubmitted}
                byLearner={byLearner}
                through={byTeam ? throughOf : undefined}
                teams={byTeam}
                loading={delegationLoading}
                error={delegationError}
                refreshing={refreshing}
                exporting={exporting}
                onRetry={() => {
                  delegationQuery.refetch();
                  gradersQuery.refetch();
                }}
                onChanged={delegationQuery.refetch}
                onRefresh={refreshSubmissionWorkspace}
                onExport={exportCurrentView}
              />
              {canGrade && (
                <Card>
                  <CardHeader className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {byTeam
                          ? "Team work and grades"
                          : "Learner work and grades"}
                      </CardTitle>
                    </div>
                    <ConfirmAction
                      title="Release all complete assessment drafts for this assignment?"
                      description={
                        byTeam
                          ? teamReleaseSaid(rows, itemGrades, submissions)
                          : `This applies across the full assignment, not only the current grader scope.${hiddenDraftCount > 0 ? ` ${hiddenDraftCount} draft${hiddenDraftCount === 1 ? " is" : "s are"} outside the current scope.` : ""} Complete assessment drafts become visible to learners; incomplete or concurrently changed drafts are skipped and reported.`
                      }
                      confirmLabel="Release all assignment drafts"
                      confirmDisabled={
                        gradingDataUnavailable || draftCount === 0
                      }
                      onConfirm={releaseAll}
                      trigger={
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={gradingDataUnavailable || draftCount === 0}
                        >
                          <Send className="size-4" /> Release all drafts
                          {gradingDataReady ? ` (${draftCount})` : ""}
                        </Button>
                      }
                    />
                  </CardHeader>
                  <CardContent>
                    {submissionsLoading && !subsData ? (
                      <LoadingState label="Loading learner work…" />
                    ) : submissionsError && !subsData ? (
                      <ErrorState
                        message={submissionsError}
                        refused={submissionsRefused}
                        onRetry={refetchSubmissions}
                      />
                    ) : !gradingDataReady ? (
                      gradingDataLoading ? (
                        <LoadingState label="Loading grading data…" />
                      ) : (
                        <ErrorState
                          message={
                            gradingDataError ?? "Grading data is unavailable."
                          }
                          refused={gradingDataRefused}
                          onRetry={refetchGradingData}
                        />
                      )
                    ) : rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No learners are assigned yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {submissionsError ? (
                          <div
                            role="alert"
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
                          >
                            <p className="min-w-0 flex-1">
                              Learner work could not be refreshed. Last loaded
                              work and unsaved grading input are retained. Retry
                              before making grade changes.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={submissionsLoading}
                              onClick={refetchSubmissions}
                            >
                              {submissionsLoading
                                ? "Retrying…"
                                : "Retry learner work"}
                            </Button>
                          </div>
                        ) : null}
                        {visibleAssigned.length === 0 ? (
                          <div className="space-y-3 py-6 text-center">
                            <p className="text-sm text-muted-foreground">
                              {byTeam
                                ? "No teams match."
                                : "No learners match."}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setFromGrades(null);
                                setGraderFilter(ALL_GRADERS);
                              }}
                            >
                              {byTeam ? "Show all teams" : "Show all learners"}
                            </Button>
                          </div>
                        ) : null}
                        <GradingDataNotice
                          loading={gradingDataLoading}
                          error={gradingDataError}
                          onRetry={refetchGradingData}
                        />
                        {workspaceAssigned.map((learner) => {
                          const learnerId = String(learner.assignee);
                          const learnerLabel =
                            learner.displayName ??
                            learner.username ??
                            learner.email ??
                            learnerId;
                          const attempts = submissions
                            .filter(
                              (submission) =>
                                submission.submitter === learnerId,
                            )
                            .sort((left, right) => left.number - right.number);
                          const latest = selectSubmissionAttempt(attempts);
                          const learnerGrades = grades.filter(
                            (grade) =>
                              grade.learner === learnerId &&
                              grade.item === assignment,
                          );
                          const newAttemptNeedsReview =
                            learnerState(attempts, learnerGrades)?.state ===
                            "new-attempt";
                          const visibleAssessment =
                            selectExportAssessment(learnerGrades, latest)
                              .record ??
                            (byTeam && newAttemptNeedsReview
                              ? learnerGrades
                                  .filter((grade) => grade.attempt !== null)
                                  .sort(
                                    (left, right) =>
                                      (right.attempt ?? 0) -
                                      (left.attempt ?? 0),
                                  )[0]
                              : undefined);
                          const lateDays = byTeam
                            ? 0
                            : (lateMap.get(learnerId) ?? 0);
                          const differing = byTeam
                            ? draftsThatDiffer(itemGrades, learnerId)
                            : [];
                          const earlier = learner.team
                            ? (earlierOf.get(learnerId) ?? 0)
                            : 0;
                          const isGrading = gradingUser === learnerId;
                          const selectedAssessment = learnerGrades.find(
                            (grade) =>
                              grade.evidence === (gradingEvidence ?? ""),
                          );

                          return (
                            <div
                              key={learnerId}
                              hidden={!visibleLearnerSet.has(learnerId)}
                              className="space-y-3 rounded-lg border border-border p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="flex items-center gap-2 font-medium">
                                    {learnerLabel}
                                    {learner.noTeam ? (
                                      <Fact.Kind>No team</Fact.Kind>
                                    ) : null}
                                    {!learner.team &&
                                    learner.enrolment === "DROPPED" ? (
                                      <StatusBadge status="DROPPED" />
                                    ) : null}
                                  </p>
                                  {learner.team ? (
                                    <p className="text-sm">
                                      {learner.members.map((member, index) => (
                                        <span key={String(member.assignee)}>
                                          {index > 0 ? ", " : null}
                                          {member.displayName ??
                                            member.username ??
                                            member.email ??
                                            String(member.assignee)}
                                          {member.enrolment === "DROPPED" ? (
                                            <StatusBadge
                                              status="DROPPED"
                                              className="ml-1.5"
                                            />
                                          ) : null}
                                        </span>
                                      ))}
                                    </p>
                                  ) : null}
                                  <Facts className="text-muted-foreground text-xs">
                                    {latest ? (
                                      <Fact.Count
                                        n={attempts.length}
                                        noun="attempt"
                                      />
                                    ) : (
                                      <span>No submission yet</span>
                                    )}
                                    {latest?.status === "WITHDRAWN" ? (
                                      <Fact.Status status="WITHDRAWN" />
                                    ) : null}
                                    {lateDays > 0 ? (
                                      <Fact.Count
                                        n={lateDays}
                                        noun="late day"
                                      />
                                    ) : null}
                                    {learner.team && learner.dueOverride ? (
                                      <Fact.Due
                                        verb="Due"
                                        at={learner.dueOverride}
                                      />
                                    ) : null}
                                    {earlier > 0 ? (
                                      <Fact.Count
                                        n={earlier}
                                        noun="earlier submission"
                                        className="font-medium text-amber-700 dark:text-amber-400"
                                      />
                                    ) : null}
                                    {latest ? (
                                      <Fact.When
                                        verb="Latest"
                                        at={latest.submittedAt}
                                      />
                                    ) : null}
                                  </Facts>
                                  {attempts.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                      {attempts.map((attempt) => {
                                        const author = !byTeam
                                          ? null
                                          : learner.team
                                            ? (authorData?.[
                                                attempt.submission
                                              ] ?? null)
                                            : attempt.submitterName;
                                        const draft = byTeam
                                          ? itemGrades.find(
                                              (grade) =>
                                                grade.status === "DRAFT" &&
                                                grade.evidence ===
                                                  attempt.submission,
                                            )
                                          : undefined;
                                        const draftScore = draft
                                          ? gradeSaid(draft)
                                          : null;
                                        return (
                                          <details
                                            key={attempt.submission}
                                            id={`attempt-${attempt.submission}`}
                                            className="rounded-md border border-border px-2 py-1.5 text-xs"
                                          >
                                            <summary className="cursor-pointer font-medium">
                                              <Facts
                                                as="span"
                                                className="inline-flex"
                                              >
                                                <span>
                                                  Attempt #{attempt.number}
                                                </span>
                                                {author ? (
                                                  <span>{author}</span>
                                                ) : null}
                                                <Fact.When
                                                  form="absolute"
                                                  at={attempt.submittedAt}
                                                />
                                                {draft ? (
                                                  <span className="font-normal text-muted-foreground tabular-nums">
                                                    {draftScore
                                                      ? `Draft ${draftScore}`
                                                      : "Draft"}
                                                  </span>
                                                ) : null}
                                                <Fact.Status
                                                  status={attempt.status.toUpperCase()}
                                                />
                                              </Facts>
                                            </summary>
                                            <div className="mt-2 space-y-2 border-t border-border pt-2 text-sm">
                                              {attempt.artifacts.map(
                                                (artifact) =>
                                                  artifactData?.[artifact] ? (
                                                    <RenderedMarkdown
                                                      key={artifact}
                                                      html={
                                                        artifactData[artifact]
                                                      }
                                                    />
                                                  ) : (
                                                    <p
                                                      key={artifact}
                                                      className="text-muted-foreground"
                                                    >
                                                      Submission content is
                                                      unavailable.
                                                    </p>
                                                  ),
                                              )}
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                  gradingDataUnavailable ||
                                                  (attempt.status !==
                                                    "SUBMITTED" &&
                                                    !learnerGrades.some(
                                                      (g) =>
                                                        g.evidence ===
                                                        attempt.submission,
                                                    ))
                                                }
                                                onClick={() =>
                                                  openAssessment(
                                                    learnerId,
                                                    attempt.submission,
                                                  )
                                                }
                                              >
                                                Assess this attempt
                                              </Button>
                                            </div>
                                          </details>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap items-end gap-4">
                                  <GraderSelect
                                    item={assignment}
                                    learner={learner.through}
                                    learnerLabel={learnerLabel}
                                    graders={graders}
                                    current={
                                      delegationByLearner.get(learnerId) ?? null
                                    }
                                    disabled={
                                      delegationLoading ||
                                      Boolean(delegationError)
                                    }
                                    onChanged={delegationQuery.refetch}
                                  />
                                  <div className="space-y-1 pb-2 text-right text-sm">
                                    <div className="flex items-center justify-end gap-2">
                                      {visibleAssessment ? (
                                        <StatusBadge
                                          status={visibleAssessment.status}
                                        />
                                      ) : null}
                                      <span className="text-muted-foreground tabular-nums">
                                        {!visibleAssessment
                                          ? "Not started"
                                          : visibleAssessment.status ===
                                              "EXCUSED"
                                            ? visibleAssessment.evidence
                                              ? "Attempt excused"
                                              : "Assignment excused"
                                            : visibleAssessment.method ===
                                                  "POINTS" &&
                                                visibleAssessment.scored
                                              ? `${visibleAssessment.score} / ${visibleAssessment.outOf}`
                                              : `${learnerGrades.length} assessment${learnerGrades.length === 1 ? "" : "s"}`}
                                      </span>
                                    </div>
                                    {visibleAssessment?.attempt ? (
                                      <p className="text-xs text-muted-foreground">
                                        Assessed attempt #
                                        {visibleAssessment.attempt}
                                      </p>
                                    ) : null}
                                    {newAttemptNeedsReview ? (
                                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                        New attempt needs review
                                      </p>
                                    ) : null}
                                    {differing.length > 0 ? (
                                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 tabular-nums">
                                        {differingSaid(differing)}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              {canManage && (
                                <details className="text-sm">
                                  <summary className="cursor-pointer text-muted-foreground">
                                    Adjust deadline
                                  </summary>
                                  <div className="pt-3">
                                    <DueDateOverride
                                      assignment={assignment}
                                      assignee={learner.through}
                                      team={learner.team}
                                      learnerName={
                                        learner.displayName ?? learner.assignee
                                      }
                                      courseDueAt={detail.dueAt}
                                      currentDueAt={learner.dueOverride}
                                      onUpdate={refetchSubmissions}
                                    />
                                  </div>
                                </details>
                              )}

                              {isGrading && (
                                <div className="space-y-2">
                                  <Label htmlFor={`evidence-${learnerId}`}>
                                    Evidence being assessed
                                  </Label>
                                  <Select
                                    value={gradingEvidence ?? EXCUSAL}
                                    disabled={gradingDataUnavailable}
                                    onValueChange={(value) =>
                                      openAssessment(
                                        learnerId,
                                        value === EXCUSAL ? null : value,
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      id={`evidence-${learnerId}`}
                                      className="w-full"
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={EXCUSAL}>
                                        Assignment excusal (no attempt)
                                      </SelectItem>
                                      {attempts
                                        .filter(
                                          (a) =>
                                            a.status === "SUBMITTED" ||
                                            learnerGrades.some(
                                              (g) =>
                                                g.evidence === a.submission,
                                            ),
                                        )
                                        .map((a) => (
                                          <SelectItem
                                            key={a.submission}
                                            value={a.submission}
                                          >
                                            Attempt {a.number} (
                                            {a.status.toLowerCase()})
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              {isGrading && currentSetup ? (
                                <AssessmentInput
                                  key={`${learnerId}-${gradingEvidence ?? "assignment"}`}
                                  learner={learnerId}
                                  through={learner.through}
                                  learnerLabel={
                                    learner.displayName ?? learner.assignee
                                  }
                                  item={assignment}
                                  itemLabel={detail.title}
                                  evidence={gradingEvidence ?? ""}
                                  recordVersion={selectedAssessment?.version}
                                  disabled={gradingDataUnavailable}
                                  onDirtyChange={setGradingDirty}
                                  onSaved={refetchGrades}
                                />
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={gradingDataUnavailable}
                                  onClick={() =>
                                    openAssessment(
                                      learnerId,
                                      latest &&
                                        (latest.status === "SUBMITTED" ||
                                          learnerGrades.some(
                                            (grade) =>
                                              grade.evidence ===
                                              latest.submission,
                                          ))
                                        ? latest.submission
                                        : null,
                                    )
                                  }
                                >
                                  Review assessments
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </WhileShown>
          </TabsContent>
        )}
      </Tabs>
      <ConfirmAction
        open={pendingGradingTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPendingGradingTarget(null);
        }}
        title="Switch assessments?"
        description="This discards only the unsaved scores or feedback in the open editor. Saved assessments and correction history are unchanged."
        confirmLabel="Discard draft and switch"
        onConfirm={() => {
          if (!pendingGradingTarget) return;
          setGradingDirty(false);
          setGradingUser(pendingGradingTarget.learner);
          setGradingEvidence(pendingGradingTarget.evidence);
          setPendingGradingTarget(null);
        }}
      />
      <ConfirmAction
        open={pendingEdit}
        onOpenChange={setPendingEdit}
        title="Leave the grading setup?"
        description="This discards only unsaved setup or assessment input on this page. Existing assessments, released grades, and correction history are unchanged."
        confirmLabel="Discard draft and edit assignment"
        onConfirm={() => {
          setSetupDirty(false);
          setGradingDirty(false);
          setPendingEdit(false);
          setEditing(true);
        }}
      />
      <ConfirmAction
        open={pendingLeave !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLeave(null);
        }}
        title="Leave this assignment?"
        description="This discards only unsaved setup or assessment input on this page. Existing assessments, released grades, and correction history are unchanged."
        confirmLabel="Discard draft and leave"
        onConfirm={() => {
          if (!pendingLeave) return;
          const destination = pendingLeave;
          setSetupDirty(false);
          setGradingDirty(false);
          setPendingLeave(null);
          router.push(destination);
        }}
      />
    </PageContainer>
  );
}

export default function StaffAssignmentDetailPage(props: {
  params: Promise<{ assignment: string }>;
}) {
  return (
    <RequireCapability capability={["course:manage", "grade"]}>
      <Suspense
        fallback={
          <PageContainer>
            <LoadingState label="Loading assignment…" />
          </PageContainer>
        }
      >
        <StaffAssignmentDetailPageContent {...props} />
      </Suspense>
    </RequireCapability>
  );
}
