# Leech Clinic — Ludum Dare 60 ("Old Tech")

Overcooked-style co-op-less chaos in a leech ward: the house physician of the Salle Saint-Côme
(Val-de-Grâce, Paris, early 1830s) bleeds soldiers with leeches for Broussais, one shift from 8:00 to
the six o'clock bell. Sister project of `../thirty-leeches` (same palette, Pix, sounds, fonts, plate).
The design brief is `BRIEF.md`.

## Commands
- `npm run dev` — Vite on :5180 (`?seed=abc` fixes the shift; see Debug)
- `npm test` — Vitest: patient/supply/shift state machines and whole-ward scenarios, no Phaser
- `npm run sim [runs]` — bots play whole shifts through the real model; re-run after touching `src/config.ts`
- `npm run build` — typecheck + static build to `dist/` (`base: './'` for itch.io)
- `npm run zip` — `leech-clinic-itch.zip` with index.html at the root

## Layout
- `src/config.ts` — **every gameplay number**. Change balance here, never in logic.
- `src/data/lines.ts` — every word the ward says: stage notes, verbs, failure reasons, verdicts.
- `src/model/` — pure logic, **no Phaser** (tests and the sim import it):
  `patient.ts` (blood meter, leeches feeding, after-bleed, panic, faint), `supply.ts` (jar, deliveries,
  shortage), `shift.ts` (clock, stages, arrivals, takings), `ward.ts` (doctor movement + collision,
  targeting, the hand, beds and queue, floor leeches, escapes, salting), `layout.ts` (floor plan in art px).
- `src/scenes/` — Phaser: Boot (textures), Title (Traviès plate), Ward (input → model → drawing), Results.
- `src/art/` — `palette.ts` (Thirty Leeches palette + additions), `pix.ts` (palette-locked buffer),
  `sprites.ts` (every sprite drawn procedurally and registered as a texture).
- `src/audio/` — Thirty Leeches' sound system: file → filtered noise → jsfxr; `sounds.ts` lists them.

## Rules
- One art grid: `PIXEL = 3`. Textures are 1:1 Pix canvases shown at `setScale(3)`, positioned with
  `place()` in whole art pixels. Every colour comes from `PALETTE`; `Pix.set` throws on anything else.
- Text is period type at full resolution (IM Fell English headings, EB Garamond), made with `text()`
  from `ui/view.ts`. The canvas renders at `RES`× the 1280×720 stage; each scene calls `fitCamera()`.
- The scene never decides rules: it calls `ward.walk / target / interact / pump / tick` and turns the
  returned `WardEvent`s into sound and floating words.
- Every carried thing has a home station (jar, cupboard, stove, stand, bucket, door) — no softlocks.
- Seeded RNG streams (`makeRng(seed, 'ward')`) so `?seed=` reproduces a shift.
- Every `localStorage` access is wrapped in try/catch.
- Commit after each milestone; report what to playtest, what to tune, what to cut.

## Debug
- `?seed=abc` fixed shift · `?fast=4` clock 4× · `?stage=machine` start at a stage · `?notes=0` no notes.
- `window.ward` is the live model in the browser console.
- E/Space/Enter in the ward are handled on the browser's own keydown (`WardScene.press`), not Phaser's
  keyboard queue: Phaser delivers keys on the next game step and drops a tap that ends within a frame.
- The Claude desktop app's browser pane reports ~2 s of audio output latency (`AudioContext.outputLatency`);
  judge sound timing in a real browser.
