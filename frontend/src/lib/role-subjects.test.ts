import { describe, expect, test } from "bun:test";
import {
  isLastAdministrator,
  matchRoleSubject,
  type RoleSubjectAccount,
  roleSubjectRefusal,
  roleSubjectSuggestions,
  subjectIsAddress,
} from "./role-subjects.ts";

function account(
  fields: Partial<RoleSubjectAccount> & { username: string },
): RoleSubjectAccount {
  return {
    user: `user-${fields.username}`,
    email: `${fields.username}@school.edu`,
    displayName: null,
    archived: false,
    roleName: null,
    capabilities: [],
    ...fields,
  };
}

const ada = account({
  username: "ada",
  displayName: "Ada Lovelace",
  roleName: "administrator",
  capabilities: ["administer"],
});
const grace = account({
  username: "grace",
  displayName: "Grace Hopper",
  email: "Grace.Hopper@school.edu",
  roleName: "grader",
  capabilities: ["grade"],
});
const accounts = [ada, grace];

describe("reading the person an administrator types", () => {
  test("a subject holding an @ is an address, never a username", () => {
    expect(subjectIsAddress("ada@school.edu")).toBe(true);
    expect(subjectIsAddress("ada")).toBe(false);
  });

  test("an exact username names its account", () => {
    expect(matchRoleSubject("ada", accounts)).toBe(ada);
    expect(matchRoleSubject("ad", accounts)).toBeNull();
  });

  test("an account identifier still names its account", () => {
    expect(matchRoleSubject("user-grace", accounts)).toBe(grace);
  });

  test("an address matches trimmed and lower-cased", () => {
    expect(matchRoleSubject("  GRACE.hopper@school.edu ", accounts)).toBe(
      grace,
    );
  });

  test("an address nobody holds matches nobody", () => {
    expect(matchRoleSubject("nobody@school.edu", accounts)).toBeNull();
  });
});

describe("suggesting from the list already loaded", () => {
  test("nothing is suggested until something is typed", () => {
    expect(roleSubjectSuggestions("", accounts)).toEqual([]);
  });

  test("a display name, a username, or an address all find the person", () => {
    expect(roleSubjectSuggestions("hopper", accounts)).toEqual([grace]);
    expect(roleSubjectSuggestions("ADA", accounts)).toEqual([ada]);
    expect(roleSubjectSuggestions("grace.hopper@", accounts)).toEqual([grace]);
  });

  test("what somebody has started typing comes first", () => {
    const lace = account({ username: "lace", displayName: "Lace Adams" });
    expect(roleSubjectSuggestions("ada", [lace, ada])).toEqual([ada, lace]);
  });

  test("a long list is cut to the few worth showing", () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      account({ username: `person${index}` }),
    );
    expect(roleSubjectSuggestions("person", many)).toHaveLength(6);
  });
});

describe("the last administrator", () => {
  test("the only administrator is guarded", () => {
    expect(isLastAdministrator(ada, accounts)).toBe(true);
    expect(isLastAdministrator(grace, accounts)).toBe(false);
    expect(isLastAdministrator(null, accounts)).toBe(false);
  });

  test("a second administrator ends the guard", () => {
    const second = account({ username: "alan", capabilities: ["administer"] });
    expect(isLastAdministrator(ada, [...accounts, second])).toBe(false);
  });
});

describe("role refusals", () => {
  test("an address no account holds reads as a sentence about it", () => {
    expect(
      roleSubjectRefusal("NOT_FOUND", {
        subject: " nobody@school.edu ",
        action: "assign",
        matched: null,
      }),
    ).toBe("No account uses nobody@school.edu.");
  });

  test("an unmatched name says a username must be exact", () => {
    expect(
      roleSubjectRefusal("NOT_FOUND", {
        subject: "ad",
        action: "revoke",
        matched: null,
      }),
    ).toBe("No account matches “ad”. Use an exact username or email.");
  });

  test("revoking from somebody the list knows means they held no role", () => {
    expect(
      roleSubjectRefusal("NOT_FOUND", {
        subject: "grace",
        action: "revoke",
        matched: grace,
      }),
    ).toBe("@grace has no role.");
  });

  test("assigning to somebody the list knows means the role is gone", () => {
    expect(
      roleSubjectRefusal("NOT_FOUND", {
        subject: "grace",
        action: "assign",
        matched: grace,
      }),
    ).toBe("That role no longer exists.");
  });

  test("a conflict is the last-administrator guard", () => {
    expect(
      roleSubjectRefusal("CONFLICT", {
        subject: "ada",
        action: "revoke",
        matched: ada,
      }),
    ).toBe("Assign another administrator first.");
  });

  test("other refusals keep their reader-facing sentence", () => {
    expect(
      roleSubjectRefusal("FORBIDDEN", {
        subject: "ada",
        action: "assign",
        matched: ada,
      }),
    ).toBe("You do not have permission to do that.");
  });
});
