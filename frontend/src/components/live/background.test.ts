import { describe, expect, test } from "bun:test";
import {
  addStands,
  classDocumentsLine,
  documentEdit,
  documentTotal,
  isReadableFile,
  nameWanting,
  removeAsked,
  titleFromFile,
} from "./background";

describe("the characters the drafter reads", () => {
  test("sums the documents' text", () => {
    expect(documentTotal([{ body: "abc" }, { body: "de" }])).toBe(5);
  });

  test("is nothing with no documents", () => {
    expect(documentTotal([])).toBe(0);
  });
});

describe("the name a chosen file fills in", () => {
  test("drops the extension the file is read by", () => {
    expect(titleFromFile("syllabus.md")).toBe("syllabus");
    expect(titleFromFile("Week 3 notes.TXT")).toBe("Week 3 notes");
  });

  test("keeps a name that carries no extension", () => {
    expect(titleFromFile(" readme ")).toBe("readme");
    expect(titleFromFile("lecture.7.md")).toBe("lecture.7");
  });
});

describe("the file the button reads", () => {
  test("reads a .txt or a .md", () => {
    expect(isReadableFile("syllabus.md", "")).toBe(true);
    expect(isReadableFile("notes.txt", "text/plain")).toBe(true);
  });

  test("reads a file the browser calls text", () => {
    expect(isReadableFile("notes", "text/markdown")).toBe(true);
  });

  test("reads nothing else", () => {
    expect(isReadableFile("reading.pdf", "application/pdf")).toBe(false);
    expect(isReadableFile("slides.pptx", "")).toBe(false);
  });
});

describe("what a saved document asks to be written", () => {
  const standing = { title: "Syllabus", body: "Week 1." };

  test("writes the name and text a hand typed", () => {
    expect(
      documentEdit({ title: "Syllabus ", body: "Week 2." }, standing),
    ).toEqual({ title: "Syllabus", body: "Week 2." });
  });

  test("writes nothing when the document stands as it was", () => {
    expect(
      documentEdit({ title: "Syllabus", body: "Week 1.\n" }, standing),
    ).toBeNull();
  });

  test("writes nothing without a name", () => {
    expect(documentEdit({ title: "  ", body: "Week 2." }, standing)).toBeNull();
  });
});

describe("what the drafter reads beside the brief", () => {
  test("counts the class's documents", () => {
    expect(classDocumentsLine(2, "questionnaire")).toBe(
      "2 shared documents available in the library.",
    );
    expect(classDocumentsLine(1, "card")).toBe(
      "1 shared document available in the library.",
    );
    expect(classDocumentsLine(3, "relay")).toBe(
      "3 shared documents available in the library.",
    );
  });

  test("says so when the class has none", () => {
    for (const asker of ["card", "questionnaire", "relay"] as const) {
      expect(classDocumentsLine(0, asker)).toBe("No shared documents added.");
    }
  });
});

describe("the question a press of Remove raises", () => {
  test("stands on the document it was raised on", () => {
    expect(removeAsked("d1", "d1")).toBe(true);
  });

  test("is nothing until Remove is pressed", () => {
    expect(removeAsked(null, "d1")).toBe(false);
  });

  test("does not follow another document opened in its place", () => {
    expect(removeAsked("d1", "d2")).toBe(false);
  });

  test("goes with the form when the card closes", () => {
    expect(removeAsked("d1", null)).toBe(false);
  });
});

describe("the way to add another document", () => {
  test("stands while a document is open to be read or corrected", () => {
    expect(addStands(false, false)).toBe(true);
  });

  test("goes while the form for a new one already stands", () => {
    expect(addStands(true, false)).toBe(false);
  });

  test("goes on a retired relay, whose documents are only read", () => {
    expect(addStands(false, true)).toBe(false);
  });
});

describe("the Name box a document is wanting", () => {
  test("asks nothing while text is given before the name", () => {
    expect(nameWanting("", false)).toBe(false);
  });

  test("wants a name once Save was pressed", () => {
    expect(nameWanting("", true)).toBe(true);
    expect(nameWanting("   ", true)).toBe(true);
  });

  test("wants nothing once a name stands", () => {
    expect(nameWanting("Syllabus", true)).toBe(false);
  });
});
