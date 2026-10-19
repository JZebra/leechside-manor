# Leech Clinic — Ludum Dare 60 ("Old Tech")

Overcooked-style single-player chaos in a leech ward: Broussais's house physician at the Val-de-Grâce
bleeds soldiers with leeches, one day's shift (8:00 to the six o'clock bell) in each of three years
synced to the real history of the leech trade and the cholera:
1828 the Salle Saint-Côme (the craze at its height; basics, anaemic men at noon; at 3 the stove is
brought up and chilled men come in from the frost — a hot-water bottle before any leech will take) ·
1831 the Salle Saint-Louis (seven beds, orderlies, runaway leeches; cholera in Hungary slows
deliveries; the bdellometer at 12:30, drummer boys and nervous conscripts at 3) · 1832 the cholera
(no deliveries at all; the cold, blue men are cholera patients; faster from 1 pm).
Made for Ludum Dare 60 by John Shen, using Claude AI (credits screen: C on the title page). Sister project of `../thirty-leeches` (same palette, Pix, sounds, fonts).
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
- `src/config.ts` — **every gameplay number**: the years (`days[]`: year, ward, length, jar, delivery
  schedule or null, escapes, orderlies, what the cold men are called, stages, verdict lines), stages
  (arrival rate, patient mix, share of cold men, and whether the stove / bdellometer are in the ward),
  slips, orderlies. Change balance here, never in logic. Historical basis:
  ~34 M leeches imported in 1827, peak ~57 M in 1832; cholera in Hungary July 1831 (Austrian
  cordon); Paris cholera spring 1832; Broussais's bleeding failed and leeching declined after.
- `src/data/lines.ts` — every word the ward says: stage notes, verbs, failure reasons, verdicts.
- `src/model/` — pure logic, **no Phaser** (tests and the sim import it):
  `patient.ts` (blood meter, leeches feeding, after-bleed, chilled/warmed, panic, faint), `supply.ts`
  (jar, deliveries), `shift.ts` (one day: clock, stages, arrivals, takings), `ward.ts` (doctor movement,
  collision, slips; targeting; the hand; beds and queue; floor leeches, escapes, salting; orderlies),
  `layout.ts` (the two floor plans in art px: beds, stations with sprite box / footprint / reach rect,
  orderly routes).
- `src/scenes/` — Phaser: Boot (textures), Title (BnF Fr. 127 miniature: Galerius eaten by worms; year
  select; C for credits), Ward (input → model → drawing), Results, Credits.
- `src/art/` — `palette.ts` (Thirty Leeches palette + additions), `pix.ts` (palette-locked buffer),
  `sprites.ts` (every sprite drawn procedurally and registered as a texture).
- `src/audio/` — Thirty Leeches' sound system: file → filtered noise → jsfxr; `sounds.ts` lists them.
  Recordings (CC0, credited in `CREDITS.md`) live in `public/sfx/` as mono 96 kbps MP3s, peak-normalised
  and trimmed; a sound's `vol` places it in the mix and its synth stays as the fallback. The ward's
  `ambience()` drives footsteps and the heartbeat (worst man in the blue sets tempo and pitch); the
  kettle is heard only when a hot-water bottle is filled.
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
