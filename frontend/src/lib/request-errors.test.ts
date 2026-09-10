import { describe, expect, test } from "bun:test";
import {
  CommonsError,
  isClientErrorCode,
  publicErrorMessage,
  requestErrorMessage,
  unwrap,
  withRequestErrors,
} from "./api";

const CLIENT_FAILURES = [
  [
    "NETWORK_ERROR",
    "Could not reach Commons. Check your connection and try again.",
  ],
  ["TIMED_OUT", "The request timed out. Try again."],
  ["ABORTED", "The request was canceled."],
  [
    "HEADER_RESOLUTION_FAILED",
    "The request could not be completed. Try again.",
  ],
  ["BAD_JSON", "The request could not be completed. Try again."],
  ["BAD_STATUS", "The request could not be completed. Try again."],
  ["RESPONSE_TOO_LARGE", "The request could not be completed. Try again."],
  ["INVALID_INPUT", "The request could not be completed. Try again."],
  ["TRANSPORT_ERROR", "The request could not be completed. Try again."],
] as const;

describe("request failure presentation", () => {
  for (const [code, message] of CLIENT_FAILURES) {
    test(`resolved ${code} has safe copy and is not a query refusal`, async () => {
      const envelope = {
        error: code,
        detail: "private response or credential",
      };
      expect(isClientErrorCode(code)).toBe(true);
      expect(publicErrorMessage(code)).toBe(message);
      expect(requestErrorMessage(envelope)).toBe(message);
      try {
        await withRequestErrors(async () => envelope);
        throw new Error("Expected client fault");
      } catch (failure) {
        expect(failure).toBeInstanceOf(CommonsError);
        expect((failure as CommonsError).code).toBeNull();
        expect((failure as CommonsError).message).toBe(message);
      }
    });
  }

  test("unwrapped client envelopes retain codes but never unsafe details", async () => {
    for (const [code, message] of CLIENT_FAILURES) {
      try {
        unwrap({ error: code, detail: "private body" });
        throw new Error("Expected client fault");
      } catch (failure) {
        expect(failure).toBeInstanceOf(CommonsError);
        expect((failure as CommonsError).code).toBe(code);
        expect(requestErrorMessage(failure)).toBe(message);
      }
      try {
        await withRequestErrors(async () => unwrap({ error: code }));
        throw new Error("Expected client fault");
      } catch (failure) {
        expect((failure as CommonsError).code).toBeNull();
        expect((failure as CommonsError).message).toBe(message);
      }
    }
  });

  test("only documented client codes are classified, with safe unknown-code fallbacks", () => {
    for (const code of [
      "FORBIDDEN",
      "INVALID_REQUEST",
      "UNAUTHORIZED",
      "NOT_FOUND",
    ])
      expect(isClientErrorCode(code)).toBe(false);
    for (const code of ["constructor", "__proto__", "future_error"]) {
      expect(isClientErrorCode(code)).toBe(false);
      expect(publicErrorMessage(code)).toBe(
        "The request could not be completed.",
      );
    }
  });
  test("query adapter preserves success and declared refusals", async () => {
    const output = { template: { subject: "Welcome", body: "Hello" } };
    expect(await withRequestErrors(async () => output)).toBe(output);
    for (const error of [
      "FORBIDDEN",
      "INVALID_REQUEST",
      "NOT_FOUND",
      "UNAUTHORIZED",
    ]) {
      expect(await withRequestErrors(async () => ({ error }))).toEqual({
        error,
      });
      try {
        unwrap({ error });
      } catch (refusal) {
        expect(requestErrorMessage(refusal)).toBe(publicErrorMessage(error));
      }
    }
  });

  test("query adapter safely distinguishes transport, timeout and cancellation", async () => {
    for (const [error, text] of [
      [
        new Error("secret SMTP details"),
        "Could not reach Commons. Check your connection and try again.",
      ],
      [
        new DOMException("timeout", "TimeoutError"),
        "The request timed out. Try again.",
      ],
      [new DOMException("cancel", "AbortError"), "The request was canceled."],
    ] as const) {
      expect(requestErrorMessage(error)).toBe(text);
      try {
        await withRequestErrors(async () => {
          throw error;
        });
        throw new Error("Expected rejection");
      } catch (failure) {
        expect(failure).toBeInstanceOf(CommonsError);
        expect((failure as CommonsError).code).toBeNull();
        expect((failure as CommonsError).message).toBe(text);
      }
    }
  });
});
