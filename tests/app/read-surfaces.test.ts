import { describe, expect, test } from "vite-plus/test";
import { assembleCommons } from "../../src/assembly/application.ts";
import { theAssignmentsOf } from "../../src/composition/course/assignments.ts";
import { theRoster } from "../../src/composition/course/roster.ts";
import { theHomeFeedByActivity, theThreadContext } from "../../src/composition/forum/feed.ts";
import { theModerationQueue } from "../../src/composition/forum/moderation.ts";

describe("composed application reads", () => {
  test("the assignments read returns each assigned learner release", async () => {
    const app = assembleCommons();
    const learner = "learner";
    const at = new Date("2026-07-19T12:00:00.000Z");
    const { assignment } = await app.concepts.Assigning.createDraft({
      author: "staff",
      title: "Design exercise",
      instructions: "Describe the behavior.",
      kind: "HOMEWORK",
      availableAt: "2026-07-19T12:00:00.000Z",
      dueAt: "2026-07-20T12:00:00.000Z",
      closeAt: "2026-07-21T12:00:00.000Z",
      acceptsSubmissions: true,
      audience: "EVERYONE",
      targets: [],
      at,
    });
    await app.concepts.Assigning.publish({ assignment, at });
    await app.concepts.Assigning.assign({ assignment, assignee: learner, at });

    expect(await app.form(theAssignmentsOf(learner))).toEqual([
      expect.objectContaining({
        assignment,
        release: expect.any(String),
        status: "ASSIGNED",
        dueOverride: null,
      }),
    ]);
  });

  test("the forum pages receive their complete formed rows", async () => {
    const app = assembleCommons();
    const at = new Date("2026-07-19T12:00:00.000Z");
    const later = new Date("2026-07-19T13:00:00.000Z");
    const { post } = await app.concepts.Posting.create({
      author: "mara",
      content: "How should this work?",
      at,
    });
    const { conversation, node } = await app.concepts.Conversing.start({ item: post, at });
    const { post: reply } = await app.concepts.Posting.create({
      author: "noah",
      content: "Start from the behavior.",
      at: later,
    });
    await app.concepts.Conversing.reply({ item: reply, parent: node, at: later });
    const { category } = await app.concepts.Categorizing.createCategory({
      name: "Design",
      description: "Questions about the design",
    });
    await app.concepts.Categorizing.assign({ item: post, category });
    const { tag } = await app.concepts.Tagging.createTag({ name: "concepts" });
    await app.concepts.Tagging.addTag({ target: post, tag });
    await app.concepts.Locking.lock({ target: conversation, at });
    await app.concepts.Resolving.accept({ question: post, answer: reply, by: "mara", at: later });

    expect(await app.form(theHomeFeedByActivity())).toEqual([
      expect.objectContaining({
        conversation,
        item: post,
        post: expect.objectContaining({ author: "mara", content: "How should this work?" }),
        category: { category, name: "Design", description: "Questions about the design" },
        tags: [{ tag, name: "concepts" }],
        replyCount: 1,
        lastActivityAt: later,
        participants: ["mara", "noah"],
        locked: true,
        resolved: true,
      }),
    ]);

    expect(await app.form(theThreadContext(conversation))).toEqual([
      expect.objectContaining({
        item: post,
        category: { category, name: "Design", description: "Questions about the design" },
        tags: [{ tag, name: "concepts" }],
        locked: true,
        acceptedAnswer: reply,
        replyCount: 1,
        lastActivityAt: later,
        participants: ["mara", "noah"],
      }),
    ]);
  });

  test("the moderation queue carries each target's flags and post", async () => {
    const app = assembleCommons();
    const at = new Date("2026-07-19T12:00:00.000Z");
    const { post } = await app.concepts.Posting.create({
      author: "mara",
      content: "Review this post",
      at,
    });
    const { conversation } = await app.concepts.Conversing.start({ item: post, at });
    await app.concepts.Flagging.flag({ reporter: "noah", target: post, reason: "spam", at });
    await app.concepts.Flagging.flag({ reporter: "iris", target: post, reason: "duplicate", at });

    expect(await app.form(theModerationQueue())).toEqual([
      expect.objectContaining({
        target: post,
        count: 2,
        conversation,
        post: expect.objectContaining({ content: "Review this post" }),
        flags: expect.arrayContaining([
          expect.objectContaining({ reporter: "noah", reason: "spam" }),
          expect.objectContaining({ reporter: "iris", reason: "duplicate" }),
        ]),
      }),
    ]);
  });

  test("the roster read carries the active seat and section", async () => {
    const app = assembleCommons();
    const { section } = await app.concepts.Rostering.createSection({
      name: "Section A",
      location: "Room 9",
      meetingPattern: "F 1pm",
    });
    const { created } = await app.concepts.Rostering.importSeats({
      rows: [
        {
          externalKey: "learner-1",
          email: "learner@example.edu",
          rosterName: "Learner One",
          kind: "STUDENT",
          section: section._id,
        },
      ],
    });
    await app.concepts.Rostering.claimSeat({ seat: created[0]._id, user: "learner" });

    expect(await app.form(theRoster())).toEqual([
      expect.objectContaining({
        seat: created[0]._id,
        user: "learner",
        section: section._id,
        rosterName: "Learner One",
      }),
    ]);
  });
});
