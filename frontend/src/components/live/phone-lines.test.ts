import { describe, expect, test } from "bun:test";
import { identityLine, trayLine } from "./phone-lines";

describe("who the phone says is holding it", () => {
  test("names the signed-in participant", () => {
    expect(identityLine("Ada Lovelace", null)).toBe("Ada Lovelace");
  });

  test("keeps the name over the way the device arrived", () => {
    expect(identityLine("Ada Lovelace", "code")).toBe("Ada Lovelace");
  });

  test("says a device that came through the join page joined by code", () => {
    expect(identityLine(null, "code")).toBe("Joined by code");
  });

  test("says a device that opened the link or scanned the code is anonymous", () => {
    expect(identityLine(null, null)).toBe("Anonymous");
    expect(identityLine("", null)).toBe("Anonymous");
    expect(identityLine(null, "qr")).toBe("Anonymous");
  });
});

describe("what the phone says the tray holds", () => {
  test("counts every card in the tray", () => {
    expect(trayLine(4, false)).toBe("4 in the tray");
  });

  test("says so while a card of this phone's is still unsorted", () => {
    expect(trayLine(4, true)).toBe("4 in the tray, yours pending");
  });

  test("says nothing about an empty tray", () => {
    expect(trayLine(0, false)).toBeNull();
    expect(trayLine(0, true)).toBeNull();
  });
});
