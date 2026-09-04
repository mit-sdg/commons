import {
  type CommonsBrowserWire,
  createCommonsClient,
} from "../../../src/client.ts";

export type Path = keyof CommonsBrowserWire & string;
export type Input<P extends Path> = CommonsBrowserWire[P]["input"];
export type Output<P extends Path> = CommonsBrowserWire[P]["output"];

export type ApiError = { error: string };

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as ApiError).error === "string"
  );
}

/** A refusal thrown past `unwrap`, carrying the boundary's category. */
export class CommonsError extends Error {
  constructor(
    message: string,
    readonly code: string | null = null,
  ) {
    super(message);
  }
}

const publicErrorMessages: Record<string, string> = {
  INVALID_REQUEST: "Check the information you entered and try again.",
  UNAUTHORIZED: "Sign in and try again.",
  FORBIDDEN: "You do not have permission to do that.",
  NOT_FOUND: "That item is not available.",
  CONFLICT: "That change cannot be made right now.",
  INTERNAL_ERROR: "Something went wrong. Try again later.",
};

export function publicErrorMessage(error: string): string {
  return publicErrorMessages[error] ?? "The request could not be completed.";
}

export function unwrap<T>(result: T): Exclude<T, ApiError> {
  if (isApiError(result))
    throw new CommonsError(publicErrorMessage(result.error), result.error);
  return result as Exclude<T, ApiError>;
}

export const api = createCommonsClient();
