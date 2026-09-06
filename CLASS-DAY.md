# Run a class on your laptop

One laptop runs Commons for the room. Staff screens open on the laptop, the projector shows the room's screen, and phones join over the room's Wi-Fi. This page is the whole procedure; nothing on it assumes you have read the rest of the repository.

## Before class

**The address.** Phones reach the laptop by its address on the room's network, so find it first. On macOS with Wi-Fi:

```sh
ipconfig getifaddr en0
```

It prints something like `192.168.68.61`. That address changes when you join another network, so check it in the room, not at home.

**The model's key.** Sorting, sample answers, drafting, and model seats use Gemini. Put the key in `.env` at the repository root, once:

```
GEMINI_API_KEY=...
```

Without it the stack still runs, the edge log says `the reasoner is disabled.`, and the wall is sorted by hand (see below).

**Start.** From the repository root, with the address you found:

```sh
PARTICIPANT_ORIGIN=http://192.168.68.61:3000 bun dev
```

`PARTICIPANT_ORIGIN` is the address printed under every QR code and on every join screen, so it has to be the one phones can reach. Setting it also opens the web server to the network (`WEB_HOST=0.0.0.0`); leave `WEB_HOST` alone unless you need to bind one interface. Leave `PUBLIC_ORIGIN` unset: the edge accepts only `https://` or a loopback address there, so it stays on the laptop while phones reach the pages over the network. The first start downloads a MongoDB binary, so start once at home with a minute to spare. macOS may ask whether `bun` may accept incoming connections; allow it, or no phone joins.

The stack is ready when the terminal prints `✓ Ready` after `frontend starting at http://127.0.0.1:3000`. Its database is temporary: everything from the class is gone when the stack stops. To keep the runs, set `MONGODB_URL` to a database of your own before starting; otherwise read the results before you press Ctrl-C.

**Which screen opens where.**

- Staff screens open on the laptop, in Chrome, at `http://127.0.0.1:3000`. Sign in as the local stack's staff account, `mara` / `password123`. Use that address exactly: over plain `http://` a session holds only on `127.0.0.1` in a Chromium browser, so signing in at the network address is refused, and Safari forgets you.
- Phones open the network address, by the QR code or by typing the code on the wall at `http://192.168.68.61:3000/join`. Phones need no account and no browser in particular.
- The projector is a second Chrome window of the same laptop session, dragged to the second display and made full screen.

**A dry run.** Do this once before the class, at home: start the stack as above, write a relay from the `Live` list at `/staff/live` (or open one you made), press `Launch`, and join from your own phone by the QR code. If the phone joins, the room will.

## During class

From the `Live` list at `/staff/live`, open the relay and press `Launch`. On a fresh stack the list is empty: `New`, then `New relay`, a title, `Create`, `Add a round` with the prompt, and `Launch` from the editor. Launch opens the run's dashboard, which shows the join code and the address under a QR code; read both aloud. Press `Project` on the dashboard to open the room's screen, and move that window to the projector.

Open round 1 from the dashboard when the phones are out. Answers arrive on the wall as cards. Close the round when the room has answered. When the relay has another round, pick the piles that carry into it (`Top` with a count beside it, `All`, or `By hand`) and open the next.

**Sorting.** The `Sorting` panel on the dashboard holds the switch `Model sorts`. It starts off, so the cards wait in the tray until you turn it on. On, the model places each card in a pile as it lands, and the panel says `sorting…` until the wall settles. The relay's note to the sorter, written in the editor before class, stands beside a box for this run's note; whatever you type there reaches the model on its next ask. `Resort` empties the piles and asks the model to place everything again. With the switch off the same button reads `Empty the piles`, and the piles are yours: drag a card onto a pile or onto `New pile`, or open the card's `Move to` menu, and drag a card to `Remove` to take it off the wall.

**When the model is slow or gone.** The panel says `The model is not answering.` when its last ask failed. Turn `Model sorts` off, sort by hand, and carry on; the room sees the wall you make. When the model is back, turn the switch on and press `Resort`, or leave the wall as it stands. Without a key every ask fails at once, so the panel says `The model is not answering.` whenever the switch is on; leave it off and sort by hand from the start, and invite no `Model seats`, since a seat with no model never hands in.

**A phone that lost its page.** Have them scan the code again, or reopen the address in the same browser. That browser remembers who the phone was and what it answered, and comes back to where it left off; a phone that already handed in says so. A different browser is a new phone, and the first stays counted.

**Quizzes and surveys.** From the `Live` list, `New` makes a quiz or a survey. Give it a title, press `Create`, then `Add question`: a quiz question with choices needs one marked as the answer before the quiz can launch, and `Save question` keeps each one. Launch and project it the same way. A phone lands on the quiz's cover and presses `Join` once more before the questions. The projector shows the join code while the run is open and the room's tallies once it closes.

## After class

Press `Close run` on the dashboard and confirm. Nobody joins or hands in after that; the dashboard keeps the walls, the tallies, and the scores, and the relay's overview lists the run by when it opened and closed. Read them, or save them, before stopping the stack: press Ctrl-C once in the terminal, and the temporary database goes with it.
