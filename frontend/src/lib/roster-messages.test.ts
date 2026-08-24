import { describe, expect, test } from "bun:test";
import {
  classSettingsRefusal,
  seatRemovalRefusal,
  seatRemovedMessage,
} from "./roster-messages.ts";

describe("class settings refusals", () => {
  test("a conflict while revising reads as no class being configured", () => {
    expect(classSettingsRefusal("CONFLICT", true)).toBe(
      "This deployment has no class configured, so there was nothing to revise. Set the class up below.",
    );
  });

  test("a conflict while setting up reads as a class already existing", () => {
    expect(classSettingsRefusal("CONFLICT", false)).toBe(
      "A class is already configured for this deployment. Its current details are shown below.",
    );
  });

  test("other refusals keep their reader-facing sentence", () => {
    expect(classSettingsRefusal("FORBIDDEN", true)).toBe(
      "You do not have permission to do that.",
    );
    expect(classSettingsRefusal("INVALID_REQUEST", false)).toBe(
      "Check the information you entered and try again.",
    );
  });
});

describe("seat removal messages", () => {
  test("success names the address the removal freed", () => {
    expect(seatRemovedMessage("ada@example.edu")).toBe(
      "Seat removed. ada@example.edu is free to enrol again.",
    );
  });

  test("a missing seat says the seat is already gone", () => {
    expect(seatRemovalRefusal("NOT_FOUND")).toBe(
      "That seat is no longer on the roster. It may have been removed already.",
    );
  });

  test("other refusals keep their reader-facing sentence", () => {
    expect(seatRemovalRefusal("FORBIDDEN")).toBe(
      "You do not have permission to do that.",
    );
  });
});
