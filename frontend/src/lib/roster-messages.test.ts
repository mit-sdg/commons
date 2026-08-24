import { describe, expect, test } from "bun:test";
import {
  addedPersonMessage,
  addPersonRefusal,
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

describe("adding one person", () => {
  const email = "ada@school.edu";

  test("a live account is being enrolled now", () => {
    expect(addedPersonMessage({ created: true, account: "LIVE" }, email)).toBe(
      "Added ada@school.edu.",
    );
  });

  test("no account means an invitation is on its way", () => {
    expect(addedPersonMessage({ created: true, account: "NONE" }, email)).toBe(
      "Invitation queued for ada@school.edu.",
    );
  });

  test("an archived account leaves the seat waiting", () => {
    expect(
      addedPersonMessage({ created: true, account: "ARCHIVED" }, email),
    ).toBe(
      "ada@school.edu has an archived account. Restore it to complete enrollment.",
    );
  });

  test("a seat already standing was refreshed rather than doubled", () => {
    expect(addedPersonMessage({ created: false, account: "NONE" }, email)).toBe(
      "Updated the pending seat for ada@school.edu. Invitation queued for ada@school.edu.",
    );
  });

  test("a standing seat keeps the kind and section it was created with", () => {
    expect(
      addedPersonMessage({ created: false, account: "LIVE" }, email, true),
    ).toContain("Its existing kind and section were kept.");
  });

  test("nothing is said about kind and section when they matched", () => {
    expect(
      addedPersonMessage({ created: false, account: "LIVE" }, email, false),
    ).not.toContain("keeps the kind");
  });
});

describe("adding one person is refused", () => {
  const email = "ada@school.edu";

  test("an active seat is changed from the Active tab", () => {
    expect(
      addPersonRefusal("CONFLICT", {
        email,
        standing: "ACTIVE",
        section: false,
      }),
    ).toBe(
      "ada@school.edu is already active. Use Active to change or drop the seat.",
    );
  });

  test("a dropped seat is reinstated rather than added again", () => {
    expect(
      addPersonRefusal("CONFLICT", {
        email,
        standing: "DROPPED",
        section: false,
      }),
    ).toBe("ada@school.edu has a dropped seat. Reinstate it from Dropped.");
  });

  test("a seat the loaded lists cannot place is still named", () => {
    expect(
      addPersonRefusal("CONFLICT", { email, standing: "NONE", section: false }),
    ).toBe(
      "A seat already exists for ada@school.edu. Check Active or Dropped.",
    );
  });

  test("a missing section is about the section that was chosen", () => {
    expect(
      addPersonRefusal("NOT_FOUND", { email, standing: "NONE", section: true }),
    ).toBe("That section no longer exists. Choose another or leave it blank.");
  });

  test("an address Commons cannot invite says so", () => {
    expect(
      addPersonRefusal("INVALID_REQUEST", {
        email,
        standing: "NONE",
        section: false,
      }),
    ).toBe("Enter a valid email address.");
  });

  test("other refusals keep their reader-facing sentence", () => {
    expect(
      addPersonRefusal("FORBIDDEN", {
        email,
        standing: "NONE",
        section: false,
      }),
    ).toBe("You do not have permission to do that.");
  });
});
