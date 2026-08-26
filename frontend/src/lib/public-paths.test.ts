import { describe, expect, test } from "bun:test";
import { isPublicPath } from "./public-paths.ts";

describe("public frontend routes", () => {
  test("allows authentication and initial setup without a session", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/setup")).toBe(true);
  });

  test("serves password recovery signed out, because that is who needs it", () => {
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/reset-password")).toBe(true);
  });

  test("lets participants enter a room code or follow a run token signed out", () => {
    expect(isPublicPath("/join")).toBe(true);
    expect(isPublicPath("/q/example-token")).toBe(true);
  });

  test("keeps application pages behind authentication", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/admin")).toBe(false);
    expect(isPublicPath("/setup/other")).toBe(false);
  });
});
