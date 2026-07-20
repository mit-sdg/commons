import { SubmissionNotFound, SubmissionNotSubmitted, SubmissionNotWithdrawn } from "./errors.ts";

const freshID = () => crypto.randomUUID();

interface SubmissionDoc {
  assignment: string;
  submitter: string;
  number: number;
  artifacts: string[];
  submittedAt: Date;
  status: "SUBMITTED" | "WITHDRAWN";
}

export class SubmittingConcept {
  private readonly submissions = new Map<string, SubmissionDoc>();

  submit({
    assignment,
    submitter,
    artifact,
    at,
  }: {
    assignment: string;
    submitter: string;
    artifact: string;
    at: Date;
  }) {
    let number = 1;
    for (const doc of this.submissions.values()) {
      if (doc.assignment === assignment && doc.submitter === submitter && doc.number >= number) {
        number = doc.number + 1;
      }
    }
    const submission = freshID();
    this.submissions.set(submission, {
      assignment,
      submitter,
      number,
      artifacts: [artifact],
      submittedAt: at,
      status: "SUBMITTED",
    });
    return { submission };
  }

  withdraw({ submission }: { submission: string }) {
    const doc = this.submissions.get(submission);
    if (doc === undefined) {
      throw new SubmissionNotFound(submission);
    }
    if (doc.status !== "SUBMITTED") {
      throw new SubmissionNotSubmitted(submission);
    }
    doc.status = "WITHDRAWN";
    return { submission };
  }

  restore({ submission }: { submission: string }) {
    const doc = this.submissions.get(submission);
    if (doc === undefined) {
      throw new SubmissionNotFound(submission);
    }
    if (doc.status !== "WITHDRAWN") {
      throw new SubmissionNotWithdrawn(submission);
    }
    doc.status = "SUBMITTED";
    return { submission };
  }

  #row(submission: string, doc: SubmissionDoc) {
    return {
      submission,
      artifacts: [...doc.artifacts],
      submittedAt: doc.submittedAt,
      number: doc.number,
      status: doc.status,
    };
  }

  _getLatest({ assignment, submitter }: { assignment: string; submitter: string }): {
    latest: {
      submission: string;
      artifacts: string[];
      submittedAt: Date;
      number: number;
      status: string;
    };
  }[] {
    let best: [string, SubmissionDoc] | undefined;
    for (const [submission, doc] of this.submissions) {
      if (doc.assignment !== assignment || doc.submitter !== submitter) continue;
      if (doc.status !== "SUBMITTED") continue;
      if (best === undefined || doc.number > best[1].number) best = [submission, doc];
    }
    return best === undefined ? [] : [{ latest: this.#row(best[0], best[1]) }];
  }

  _getAttempts({ assignment, submitter }: { assignment: string; submitter: string }): {
    submission: string;
    artifacts: string[];
    submittedAt: Date;
    number: number;
    status: string;
  }[] {
    return [...this.submissions.entries()]
      .filter(([, doc]) => doc.assignment === assignment && doc.submitter === submitter)
      .sort(([, a], [, b]) => a.number - b.number)
      .map(([submission, doc]) => this.#row(submission, doc));
  }

  _getSubmissionsForAssignment({ assignment }: { assignment: string }): {
    submitter: string;
    submission: string;
    submittedAt: Date;
    number: number;
    status: string;
  }[] {
    return [...this.submissions.entries()]
      .filter(([, doc]) => doc.assignment === assignment)
      .sort(([, a], [, b]) => a.submittedAt.getTime() - b.submittedAt.getTime())
      .map(([submission, doc]) => ({
        submitter: doc.submitter,
        submission,
        submittedAt: doc.submittedAt,
        number: doc.number,
        status: doc.status,
      }));
  }

  _getSubmissionsForSubmitter({ submitter }: { submitter: string }): {
    assignment: string;
    submission: string;
    submittedAt: Date;
    number: number;
    status: string;
  }[] {
    return [...this.submissions.entries()]
      .filter(([, doc]) => doc.submitter === submitter)
      .sort(([, a], [, b]) => a.submittedAt.getTime() - b.submittedAt.getTime())
      .map(([submission, doc]) => ({
        assignment: doc.assignment,
        submission,
        submittedAt: doc.submittedAt,
        number: doc.number,
        status: doc.status,
      }));
  }
}
