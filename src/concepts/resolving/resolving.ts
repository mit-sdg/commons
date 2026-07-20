import { ResolutionNotFound } from "./errors.ts";

interface ResolutionDoc {
  answer: string;
  resolvedBy: string;
  resolvedAt: Date;
}

export class ResolvingConcept {
  private readonly resolutions = new Map<string, ResolutionDoc>();

  accept({ question, answer, by, at }: { question: string; answer: string; by: string; at: Date }) {
    this.resolutions.set(question, { answer, resolvedBy: by, resolvedAt: at });
    return { resolution: question };
  }

  clear({ question }: { question: string }) {
    if (!this.resolutions.has(question)) {
      throw new ResolutionNotFound(question);
    }
    this.resolutions.delete(question);
    return { question };
  }

  _isResolved({ question }: { question: string }): { resolved: boolean } {
    return { resolved: this.resolutions.has(question) };
  }

  _getResolution({ question }: { question: string }): {
    answer: string;
    resolvedBy: string;
    resolvedAt: Date;
  }[] {
    const doc = this.resolutions.get(question);
    return doc === undefined ? [] : [{ ...doc }];
  }

  _getQuestionsAnswered({ answer }: { answer: string }): { question: string }[] {
    return [...this.resolutions.entries()]
      .filter(([, doc]) => doc.answer === answer)
      .map(([question]) => ({ question }));
  }
}
