import { describe, expect, test } from "vite-plus/test";
import { publicErrorMessage } from "./api.ts";

describe("public error messages", () => {
  test.each([
    ["INVALID_REQUEST", "Check the information you entered and try again."],
    ["UNAUTHORIZED", "Sign in and try again."],
    ["FORBIDDEN", "You do not have permission to do that."],
    ["NOT_FOUND", "That item is not available."],
    ["CONFLICT", "That change cannot be made right now."],
    ["INTERNAL_ERROR", "Something went wrong. Try again later."],
    ["UNRECOGNIZED", "The request could not be completed."],
  ])("maps %s to its reader-facing sentence", (error, message) => {
    expect(publicErrorMessage(error)).toBe(message);
  });
});
