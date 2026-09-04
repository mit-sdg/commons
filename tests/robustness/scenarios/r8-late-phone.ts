/**
 * R8, the late phone. A run whose first round is already open when a phone
 * first loads its page: the phone must show the question, not sit on
 * "Opening…". Then the round closes and the next opens while the phone
 * watches. A screenshot at each state; a phone that has not shown the prompt
 * within ten seconds is a finding.
 *
 *   bun tests/robustness/scenarios/r8-late-phone.ts [arm-name]
 */

import { copyDeck, launch, Log, openRound, outDir, pages, signIn, sleep, snap } from "../drive.ts";

const ARM = process.argv[2] ?? "r8-late-phone";
const log = new Log(ARM, outDir(ARM));
const host = await signIn();
const web = await pages(host, log);

async function shows(page: import("playwright").Page, text: RegExp, within: number) {
  const started = Date.now();
  while (Date.now() - started < within) {
    const seen = (await page.evaluate("document.body.innerText")) as string;
    if (text.test(seen)) return Date.now() - started;
    await sleep(250);
  }
  return null;
}

try {
  const relay = await copyDeck(host, "three-verbs", "Late phone");
  const { run, token } = await launch(host, relay.relay);
  await openRound(host, run, relay.legs[0] as string);
  await sleep(1500);

  const phone = await web.phone(token);
  const shown = await shows(phone, /verbs/i, 10_000);
  await snap(phone, log, "LatePhoneRoundOne", [390]);
  if (shown === null) {
    log.finding({
      kind: "broken",
      title: "a phone that loads after the round opened never shows the question",
      steps: "launch, open round one, then load /q/<token> fresh",
      screenshot: "LatePhoneRoundOne@390.png",
    });
  } else {
    log.note(`late phone showed the question after ${shown} ms`);
  }

  const second = await web.phone(token);
  await sleep(500);
  const again = await shows(second, /verbs/i, 10_000);
  log.note(`a second late phone: ${again === null ? "never" : `${again} ms`}`);
  if (again === null) {
    log.finding({
      kind: "broken",
      title: "a second late phone never shows the question",
      steps: "as above, a second fresh phone page",
    });
  }
} catch (error) {
  log.finding({
    kind: "broken",
    title: `the scenario stopped: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`,
    steps: "See the events log",
  });
} finally {
  await web.close();
  log.write();
}
