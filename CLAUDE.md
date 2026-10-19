# Leech Clinic — Ludum Dare 60 ("Old Tech")

Overcooked-style single-player chaos in a leech ward: Broussais's house physician (Val-de-Grâce,
Paris, early 1830s) bleeds soldiers with leeches across three short days, 8:00 to the six o'clock bell:
Day 1 the Salle Saint-Côme (basics; anaemic men at noon) · Day 2 the Salle Saint-Louis (seven beds,
orderlies in the aisles, chilled men, runaway leeches; the bdellometer at midday) · Day 3 the shortage
(no deliveries: salted leeches are the only supply; drummer boys and nervous conscripts at noon). Sister project of `../thirty-leeches` (same palette, Pix, sounds, fonts).
Title plate: BnF Français 127 f. 258r (Boccaccio, *Des cas des nobles hommes et femmes*), via the BnF's
IIIF server; BnF terms allow free non-commercial reuse with the credit "Source gallica.bnf.fr / BnF".
The design brief is `BRIEF.md`.

## Commands
- `npm run dev` — Vite on :5180 (`?seed=abc` fixes the shift; see Debug)
- `npm test` — Vitest: patient/supply/shift state machines and whole-ward scenarios, no Phaser
- `npm run sim [runs]` — bots (idle / broussais / careful) play each day through the real model, with
  think time, detours, slips and orderlies; prints francs, verdicts, faints, slips per day. Re-run after
  touching `src/config.ts`; the per-day verdict lines are set from the careful bot's spread.
- `npm run build` — typecheck + static build to `dist/` (`base: './'` for itch.io)
- `npm run zip` — `leech-clinic-itch.zip` with index.html at the root

## Layout
- `src/config.ts` — **every gameplay number**: the days (ward, length, jar, deliveries, escapes,
  orderlies, chilled share, stages, verdict lines), stages (arrival rate, patient mix, machine), slips,
  orderlies. Change balance here, never in logic.
- `src/data/lines.ts` — every word the ward says: stage notes, verbs, failure reasons, verdicts.
- `src/model/` — pure logic, **no Phaser** (tests and the sim import it):
  `patient.ts` (blood meter, leeches feeding, after-bleed, chilled/warmed, panic, faint), `supply.ts`
  (jar, deliveries), `shift.ts` (one day: clock, stages, arrivals, takings), `ward.ts` (doctor movement,
  collision, slips; targeting; the hand; beds and queue; floor leeches, escapes, salting; orderlies),
  `layout.ts` (the two floor plans in art px: beds, stations with sprite box / footprint / reach rect,
  orderly routes).
- `src/scenes/` — Phaser: Boot (textures), Title (BnF Fr. 127 miniature: Galerius eaten by worms), Ward (input → model → drawing), Results.
- `src/art/` — `palette.ts` (Thirty Leeches palette + additions), `pix.ts` (palette-locked buffer),
  `sprites.ts` (every sprite drawn procedurally and registered as a texture).
- `src/audio/` — Thirty Leeches' sound system: file → filtered noise → jsfxr; `sounds.ts` lists them.
  `music.ts`: looping tracks from `public/music/` (title: "Ancient Rite", ward: "Vanishing", Kevin
  MacLeod, CC BY 4.0 — credit kept on the title page and in `CREDITS.md`), crossfaded per scene,
  unlocked on the first key/click (all tracks primed then, for Safari), muted with M. Re-encode new
  tracks to ~128 kbps MP3 (`ffmpeg -i in.mp3 -map 0:a -map_metadata 0 -b:a 128k out.mp3`).

## Rules
- One art grid: `PIXEL = 3`. Textures are 1:1 Pix canvases shown at `setScale(3)`, positioned with
  `place()` in whole art pixels. Every colour comes from `PALETTE`; `Pix.set` throws on anything else.
- Text is period type at full resolution (IM Fell English headings, EB Garamond), made with `text()`
  from `ui/view.ts`. The canvas renders at `RES`× the 1280×720 stage; each scene calls `fitCamera()`.
- The scene never decides rules: it calls `ward.walk / target / interact / pump / tick` and turns the
  returned `WardEvent`s into sound and floating words.
- Every carried thing has a home station (jar, cupboard, stove, stand, bucket, door) — no softlocks.
- Targeting: stations are reached from their base (`use` rect), not their sprite; what the doctor faces
  wins ties; a runaway leech and a bed's need edge out furniture.
- Seeded RNG streams (`makeRng(seed, 'ward')`) so `?seed=` reproduces a shift.
- Every `localStorage` access is wrapped in try/catch.
- Commit after each milestone; report what to playtest, what to tune, what to cut.

## Debug
- `?seed=abc` fixed shift · `?day=2` open that day (unlocks all on the title) · `?fast=4` clock 4× ·
  `?stage=machine` start the day at a stage · `?notes=0` no notes. Progress lives in `lc-progress`.
- `window.ward` is the live model in the browser console.
- E/Space/Enter in the ward are handled on the browser's own keydown (`WardScene.press`), not Phaser's
  keyboard queue: Phaser delivers keys on the next game step and drops a tap that ends within a frame.
- The Claude desktop app's browser pane reports ~2 s of audio output latency (`AudioContext.outputLatency`);
  judge sound timing in a real browser. The pause screen shows the browser's latency figures; in-graph,
  sounds reach the output within ~15 ms of the event.
- A hidden browser pane throttles frames to ~1/s: drive `game.step()` and snapshot the renderer to inspect.
