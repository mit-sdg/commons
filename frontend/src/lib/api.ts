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

/** An error envelope thrown past `unwrap`: a refusal or a handled client fault. */
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

/** Public beta.16 client codes are resolved envelopes, not domain refusals. */
const clientErrorMessages = {
  NETWORK_ERROR:
    "Could not reach Commons. Check your connection and try again.",
  TIMED_OUT: "The request timed out. Try again.",
  ABORTED: "The request was canceled.",
  HEADER_RESOLUTION_FAILED: "The request could not be completed. Try again.",
  BAD_JSON: "The request could not be completed. Try again.",
  BAD_STATUS: "The request could not be completed. Try again.",
  RESPONSE_TOO_LARGE: "The request could not be completed. Try again.",
  INVALID_INPUT: "The request could not be completed. Try again.",
  TRANSPORT_ERROR: "The request could not be completed. Try again.",
} as const;

export function isClientErrorCode(
  code: string,
): code is keyof typeof clientErrorMessages {
  return Object.hasOwn(clientErrorMessages, code);
}

export function publicErrorMessage(error: string): string {
  if (isClientErrorCode(error)) return clientErrorMessages[error];
  return Object.hasOwn(publicErrorMessages, error)
    ? publicErrorMessages[error]
    : "The request could not be completed.";
}

export function unwrap<T>(result: T): Exclude<T, ApiError> {
  if (isApiError(result))
    throw new CommonsError(publicErrorMessage(result.error), result.error);
  return result as Exclude<T, ApiError>;
}

/** Declared refusals keep their public meaning; thrown request faults do not. */
export function requestErrorMessage(error: unknown): string {
  if (error instanceof CommonsError)
    return error.code === null ? error.message : publicErrorMessage(error.code);
  if (isApiError(error)) return publicErrorMessage(error.error);
  if (error instanceof Error) {
    if (error.name === "AbortError") return "The request was canceled.";
    if (error.name === "TimeoutError")
      return "The request timed out. Try again.";
  }
  return "Could not reach Commons. Check your connection and try again.";
}

/** Preserve refusals, but keep client faults out of a query's `refused` field. */
export async function withRequestErrors<T>(
  request: () => Promise<T>,
): Promise<T> {
  try {
    const result = await request();
    if (isApiError(result) && isClientErrorCode(result.error)) {
      throw new CommonsError(publicErrorMessage(result.error));
    }
    return result;
  } catch (error) {
    if (error instanceof CommonsError && !isClientErrorCode(error.code ?? ""))
      throw error;
    throw new CommonsError(requestErrorMessage(error));
  }
}

export const api = createCommonsClient();
