# LEECHSIDE MANOR (working title: Leech Clinic) — Ludum Dare 60 (brief, v2)

A sister game to **Thirty Leeches** (`../thirty-leeches`): same hospital, same year, same palette,
same leeches — but where Thirty Leeches is a slow game about reading the rulebook and counting the
dead, Leech Clinic is a fast one about keeping six beds bleeding at the right rate.

## What changed from v1 of this brief

- **New repo.** There is no existing prototype; Priority 0 is now scaffolding plus porting the art,
  sound and writing systems already built for Thirty Leeches (listed in §2).
- **Setting and cast** are the Thirty Leeches world: the Salle Saint-Côme at the Val-de-Grâce,
  Paris, under Broussais; Sister Marthe, Madame Ricard the apothecary, soldiers and drummer boys.
- **Art direction** is the Thirty Leeches pixel art (one 3px grid, one SNES-style palette) with
  period serif type, instead of "cartoonish Victorian" (Victoria is crowned in 1837; this is 1830s
  France).
- **Mechanics are period-correct where it costs nothing:** sugar-water (not just a warm compress) to
  coax stubborn leeches; lint and **amadou** to staunch bites; **salt** to make a leech let go early;
  **Sarlandière's bdellometer** (Paris, 1819) as the mechanical leech; shortages because the leech
  trade really did strip Europe's ponds.
- **Patient types** map onto what Thirty Leeches already draws and models: anaemic soldiers (pale),
  drummer boys (bleed on), robust grenadiers, nervous conscripts.
- **Scoring** is francs and Broussais's verdict stamp, as in Thirty Leeches' audit.

---

## Playtest revisions (after the first build)

- **Chilled patients replace stubborn leeches.** A cold man (blanket to the chin, shivering, blue
  lips) takes no leech until warmed with a hot-water bottle filled at the stove; leeches in hand are a plain count (up to three;
  E at the jar with a full hand pours them back).
- **Three short days** instead of one long shift: Day 1 Saint-Côme (anaemic men at noon); Day 2
  Saint-Louis, a busier seven-bed ward whose orderlies cross the aisles and block the doctor, with
  chilled men and runaway leeches, and the bdellometer at midday; Day 3 the shortage — no deliveries
  all day, so fed leeches must be salted and reused and the machine matters.
- **Slips:** fed leeches on the floor can floor the doctor — dazed 3 s, the leech squashed, whatever
  leeches he held scattered. Fed leeches drop beside the bed, in the walkways.
- **Creepier leeches:** ringed, glistening bodies, red eyes, toothed mouths; they throb as they feed and
  crawl like inchworms.
- **Title plate:** *Mort de Galerius* (eaten by worms), BnF Français 127 f. 258r.

## 1. Project context

Single-player, Overcooked-inspired: one doctor, one ward, too many patients, a jar of leeches.

- **Ludum Dare 60**, theme **OLD TECH**. Deadline: **Monday, October 19, 2026, 3 PM Pacific.**
- **Tech:** Phaser 3 (3.90) + TypeScript + Vite. Desktop browser. Builds to static files for an
  itch.io HTML upload (`base: './'`).
- **Resolution:** a fixed 1280×720 game, `Scale.FIT`, letterboxed. All art is drawn at 1 texture
  pixel per art pixel and shown at **3×** (`PIXEL = 3`), with `pixelArt: true` and positions snapped
  to the 3px grid. Text is rendered at full resolution so period type stays crisp.
- Prioritise a complete, polished, funny game over a large unfinished one.

## 2. Reuse from Thirty Leeches

Port these rather than reinventing them (JS → TS, DOM → Phaser textures):

| What | From `../thirty-leeches/` | Use here |
|---|---|---|
| Palette: SNES-style ramps (ink, wood, paper, skin ×3, pallid/pale/wax, uniforms, red, bruise, brass, leech, glass, cholera blue) | `src/data/palette.js` | Every pixel and every UI colour |
| `Pix`: palette-locked pixel buffer (ellipse at any angle, poly, line, outline, dither, stamp, 3×5 digits) | `src/ui/pixel/canvas.js` | Draw all sprites procedurally into Phaser canvas textures |
| Leech sprite: four feeding frames, engorged red when sated, dotted rusty stripe | `src/ui/pixel/sprites.js` | Hungry, feeding, sated, used leeches; add stubborn and crawling frames |
| Stoneware leech jar, clock face, markers | same | Supply jar, shift clock |
| Patient bust 64×72: pallor ladder (own colour → pallid → pale → wax), black eyes, shakos | `src/ui/pixel/portrait.js` | Patient tickets, fainting close-ups, results screen |
| Names, ranks, regiments of the 1828 Paris garrison | `src/data/names.js` | Patient tickets |
| Sound system: recorded file → filtered noise → jsfxr, with 13 sounds (page, plip, squelch, salt, bell, stamp, thud, gasp…) | `src/ui/audio.js`, `src/data/sounds.js` | All SFX; add pump, stretcher, kettle, crawl |
| Fonts: IM Fell English (headings), EB Garamond (everything else), Latin subsets | `@fontsource/*` | HUD, cards, results |
| Title plate: *Mort de Galerius*, Boccaccio, *Des cas des nobles hommes et femmes*, Paris, 3rd quarter 15th c., BnF Français 127 f. 258r (non-commercial reuse, credit "Source gallica.bnf.fr / BnF") | `public/art/` | Title screen, credited |
| Period voices: Broussais's memos, Sister Marthe's notes, Madame Ricard at the counter | `src/data/text.js`, `src/ui/screens/evening.js` | Shift announcements |
| Propositions 266 (children bleed beyond measure), 268 (don't bleed the bloodless), 332 (stop bites that bleed through a faint) | `src/data/propositions.js` | Tutorial cards that explain patient types |
| Audit stamps APPROVED / NOTED / REPRIMAND and remarks | `src/data/economy.js` | End-of-shift verdict |

## 3. Setting, cast and tone

Paris, early 1830s, at the height of the leech craze. The **Salle Saint-Côme**, a ward of the
**Val-de-Grâce** military hospital. The Physician-in-Chief, **F.-J.-V. Broussais**, believes nearly
every disease is an inflamed gut and the cure is to bleed it; his standing order is thirty leeches
for every new patient. You are his house physician. The patients are soldiers of the Paris garrison
(and the odd drummer boy). **Sister Marthe** runs the ward; **Madame Ricard** the apothecary sells
the leeches, which come from Hungary and are always late.

Tone: grim, dry and darkly funny; cute-and-grotesque, never gory. Oversized, squishy, expressive
leeches. Blood is a meter and a few red pixels, not a spectacle.

## 4. Art and audio direction

- **Pixel art on one grid.** Every sprite is a `Pix` drawn from the palette and shown at 3×. No
  off-palette colours, gradients, blurs, rotations or sub-pixel motion; things move and swell in
  whole art pixels. The one exception is the period title plate.
- **Top-down ¾ view** of a single-screen ward: flagstones, iron bedsteads with linen, a stove with a
  kettle, the stoneware jar, a brass-and-glass bdellometer on its stand.
- **Leeches** are the stars: olive-black, rusty dotted stripe, a tiny face. Hungry ones are thin and
  wriggly; they visibly fatten through four frames while feeding and turn engorged-red when sated.
  Stubborn ones curl up, turn their face away and frown.
- **Patients** lie in bed with a readable silhouette and colour: anaemic men drawn ashen (the pale
  ramp), drummer boys small, grenadiers broad, nervous conscripts wide-eyed and trembling. Blood loss
  climbs the pallor ladder on screen, as in Thirty Leeches.
- **Type and UI:** IM Fell English headings, EB Garamond text, on paper with ink borders and a
  blood-red accent; announcements arrive as notes in period voice.
- **Sound:** reuse the Thirty Leeches sound system; recorded sounds can drop into `public/sfx/`
  later without code changes. Mute toggle required.

## 5. Core gameplay philosophy

It should feel like Overcooked, for one player. The fun is:
- managing several processes at once,
- deciding under time pressure,
- physically carrying things across the room,
- reacting to complications, choosing between competing priorities, and recovering from mistakes.

New mechanics must add decisions, not just button presses. Avoid unexplained random failure: the
player should see why something happened and how to prevent it next time. Favour mechanics that
collide with each other — a stubborn leech is a timing problem, a frail patient changes the
strategy, a shortage forces the machine, an escapee interrupts everything.

**SIMPLE ACTIONS + INTERACTING SYSTEMS = CHAOTIC FUN.**

## 6. Core gameplay

### The doctor
- WASD / arrows to move; **E / Space** to interact (hold for the bdellometer).
- Carries **one thing at a time**, shown above his head.
- Interactions are fast, forgiving and consistent; the current target is highlighted, and an
  interaction that fails says why (a word or icon over the target).

### The ward (single screen)
1. **Beds** (4–6), where patients are brought in by an orderly.
2. **Madame Ricard's jar** of hungry leeches, with a visible count.
3. **The salt bucket** for used leeches.
4. **The lint cupboard:** lint and amadou to staunch bites (the bandage).
5. **The stove and kettle:** sugar-water / warm compress (see §7.1).
6. **The door to the recovery beds** (where fainted men are carried).
7. **Sarlandière's bdellometer** on its stand (introduced mid-shift).

### Treatment
Each patient has a **blood meter** with three bands:
- **Red:** not bled enough yet.
- **Green:** bled enough; ready for lint.
- **Blue:** too much; he faints.

The doctor applies leeches. A leech **holds fast and feeds by itself** until sated (it visibly
swells), then drops off onto the floor as a **used leech**. Its **bite keeps bleeding** afterwards
(1830s doctors didn't know why — hirudin wasn't found until 1884 — but they knew it did).

**Lint and amadou** (the bandage):
- stops all bleeding and completes treatment;
- in the green band: full fee; too early (red): reduced fee;
- makes any still-attached leeches let go (they drop as used leeches).

Used leeches on the floor must be picked up and taken to the salt bucket. A treated patient walks
out and pays.

### Fainting
Into the blue band, a patient faints. He must be **carried on the stretcher** to the recovery door;
carrying slows the doctor. It costs a fine and a lot of time, but the shift goes on. (Prop. 332:
bites that bleed through a faint should have been stopped.)

## 7. New mechanics

### 7.1 Stubborn leeches — priority HIGH, complexity LOW
*Basis:* leeches often refuse to bite. 19th-century manuals say to wash the skin and smear it with
milk or sugar-water, or prick it for a drop of blood, to tempt them.

- Some leeches (start at 15–20%, configurable) are **stubborn**, and you can see it: curled, face
  turned away, a little frown — visible in the jar's pick-up and in the doctor's hands.
- Applying one to an unprepared patient fails: it recoils with a squeak and stays in your hands.
- **Preparation:** take a dab of **sugar-water** from the kettle to the patient; he shows a warm
  glow / dab icon. A stubborn leech then bites normally. Preparation lasts until his treatment ends.
- Alternatively, put the stubborn leech back in the jar and draw another (it will be a different one).
- No hidden stats: stubbornness is a visible trait, not a dice roll on each attempt.

### 7.2 Patient types — priority HIGH, complexity LOW
Recognisable at a glance (cartoon conventions, not real diagnosis):

| Type | Look | Rule |
|---|---|---|
| **Soldier** (normal) | standard | generous green band |
| **Anaemic** (frail; Prop. 268) | ashen, thin | narrow green band, faints soon after it |
| **Drummer boy** (Prop. 266) | small, bare-headed | bites bleed on fast: fewer leeches, watch the after-bleed |
| **Nervous conscript** | wide-eyed, trembling | panic meter rises when unattended or when leeches go on; faints from fright if it fills |

Build Soldier and Anaemic first; add the others once the core works. Each type should suggest a
strategy: two or three leeches on a soldier; one leech and patience on an anaemic man.

### 7.3 Escaping leeches — priority HIGH, complexity MEDIUM
*Basis:* hungry leeches climb out of jars; fed ones rest for months. (A period caricature at the
Wellcome shows an omnibus of women in hysterics over escaped leeches.)

- Hungry leeches occasionally crawl out of the jar and **wriggle slowly across the floor**, visibly.
- Pick one up and return it to the jar (or use it). Neglected too long, it slips down the drain:
  one leech lost.
- Optional escalation: it climbs onto an unattended patient and starts feeding unasked.
- Used (sated) leeches never escape; keep the two behaviours separate.

### 7.4 Sarlandière's bdellometer (mechanical leech) — priority HIGH, complexity MEDIUM
*Basis:* J.-B. Sarlandière's **bdellometer** (Paris, 1819): a glass cup with a scarifier and a
suction pump, sold as a substitute for leeches. Heurteloup's piston "artificial leech" followed a
decade or two later. This is the OLD TECH centrepiece.

- Pick the device up from its stand, carry it to a bed, and **hold E** to pump.
- Extracts quickly while held; **release to stop** instantly; leaves no after-bleed (an abstraction).
- Uses no live leeches, but the doctor can do nothing else while pumping.
- Brass and glass, a big hand pump that visibly strokes, a chamber that fills red.

The decision it must create: *"Pump this man for ten seconds, or put two leeches on him and go
deal with the others?"*

### 7.5 Leech shortages — priority MEDIUM-HIGH, complexity LOW
*Basis:* France imported over forty million leeches in 1833; ponds were stripped across Europe and
prices climbed. In 1832 the cholera wards bought up every leech in Paris.

- Madame Ricard delivers leeches at intervals. Shortages stop deliveries for a **predictable,
  announced** time: *"No leeches! The Hungarian shipment is late."* A countdown shows when they
  resume: *"Madame Ricard's boy is here with the jar."*
- The jar count is always visible. The bdellometer is always the fallback, so the player can never be
  stuck with no way to treat.

### 7.6 Optional, only if time permits (in this order)
1. **Salt (early removal):** a pinch of salt makes a feeding leech let go at once; the bite then
   bleeds on harder. Thirty Leeches already uses salt this way. A simple risk/reward, no random
   complications.
2. **Horse leeches** in a shipment: greenish, won't bite people; bin them. Oversized medicinal leech:
   feeds longer, inflates comically.
3. **Allergic reaction** (rare): swelling and panic; carry him to recovery, with a fine.
4. **Suspicious leeches** (green spots — a fictional tell): infection risk shown only on the
   end-of-shift report.

## 8. Shift structure

One polished shift, **8:00 to the six o'clock bell** (about 6–8 real minutes), with mechanics
introduced in stages by notes in period voice. The clock pauses while a note is on screen:

1. **8:00 — The basics.** Soldiers, leeches, lint, the salt bucket. *Broussais:* "Thirty leeches,
   gentlemen, and lint when they drop."
2. **10:00 — Difficult patients.** Anaemic men arrive. *Sister Marthe* warns about the pale ones
   (Prop. 268).
3. **12:00 — Uncooperative leeches.** Stubborn leeches; the first escape. *Madame Ricard:* "This lot
   are temperamental. Warm them with a little sugar-water."
4. **13:30 — Modern miracles.** The bdellometer arrives "from Dr. Sarlandière's instrument-maker".
5. **15:00 — The great shortage.** Deliveries stop for a while; drummer boys and nervous
   conscripts join the queue.

No campaign. Restart is instant.

## 9. Scoring and end of shift

- Fees in **francs**: full fee in the green, reduced if bandaged early, a fine for a faint, a fine
  for a patient who gives up waiting, a small cost per leech lost.
- At six, **Broussais's verdict** is stamped on the shift report: **APPROVED / NOTED / REPRIMAND**
  (three tiers = Overcooked's stars), with a dry remark and a list of the day's patients by name and
  outcome.

## 10. Balancing — keep every number in one place (`src/config.ts`)

Starting values are generous; pressure comes from overlapping tasks, not short timers.

- **Patients:** green band (start, width) per type; faint threshold; patience while waiting;
  after-bleed multiplier; panic rate (nervous); type probabilities per stage; arrival interval.
- **Leeches:** feeding duration (~8 s), extraction rate, after-bleed rate, stubborn chance (0.15–0.2),
  escape chance and interval, crawl speed, time before slipping away.
- **Bdellometer:** extraction rate (~3× a leech), no setup time to start.
- **Supply:** starting jar (~8), delivery interval and size, shortage start, duration and warning.
- **Shift:** real length, stage times, fees, fines, verdict thresholds.

A small headless test should be able to run the patient and leech state machines without Phaser
(Thirty Leeches' engine/UI split made its balance sim possible).

## 11. UX and feedback

- **Patients:** the meter shows red/green/blue bands with a marker; "ready" pings in green; warnings
  (pulse, pallor) before a faint; a type icon or silhouette readable from across the room.
- **Leeches:** visibly swell; flash or plop when sated; stubborn ones look stubborn; escapees
  wriggle and leave a damp trail.
- **Bdellometer:** pumping animation, a filling chamber, an instant stop.
- **Supply:** the jar count on the HUD and on the jar; shortage banner with a countdown.
- **Interaction:** highlight the target; show what you carry; forgiving reach; a failed interaction
  always says why ("He's not warm enough — try sugar-water", "Hands full").

## 12. Emergent scenarios to test against (don't script them)

- **A:** An anaemic man is near fainting, another patient is ready for lint, and a leech escapes.
- **B:** Two patients, one leech left; the bdellometer is free but needs your hands.
- **C:** Three leeches on one man; two drop and his bites run on; a new patient arrives.
- **D:** A shortage starts just after you've spent your supply; an anaemic man arrives.

## 13. Priorities (deadline Monday 3 PM)

- **P0 — Scaffold and port:** Vite + TS + Phaser; port the palette, `Pix`, leech/jar sprites,
  sound system and fonts; texture generation at boot; one ward scene; movement and interaction.
- **P1 — The core loop:** beds, jar, leeches feeding and dropping, after-bleed, lint, salt bucket,
  fainting and the stretcher, scoring, end of shift. **Then playtest: is it fun yet?**
- **P2 — Patient types and stubborn leeches** (soldier, anaemic; sugar-water).
- **P3 — Bdellometer, supply, shortages.**
- **P4 — Escapes.**
- **P5 — Optional complications** (§7.6), then drummer boys and nervous conscripts.
- **P6 — Polish and submission:** title screen with the period plate, a short tutorial (the stage
  notes), results and restart, sounds, a production build tested in an iframe.

## 14. Testing

After each change: `tsc --noEmit`, the dev build, and play. Watch especially:
leeches on anaemic men; lint with leeches still attached; a faint during treatment; used leeches
left after a patient goes; an empty jar; recovering escapees; switching between the machine and
leeches; a faint while you're carrying something; restarting mid-shortage. **No softlocks.** Keep
unit tests (Vitest) to the patient and leech state machines.

## 15. Working method

Work autonomously and incrementally; keep the game playable after every step; commit per
milestone; report what to playtest, what to tune and what to cut. Drop any mechanic that turns out
unfun or confusing — feature count is not the goal.

## 16. Historical notes (for credits and flavour)

- Broussais's "physiological medicine" made leeching the cure for nearly everything; in 1833 France
  imported over forty million leeches.
- Leeches were tempted to bite with milk, sugar-water or a drop of blood, made to let go with salt,
  and their bites staunched with lint and amadou.
- Sarlandière's bdellometer (1819) and later Heurteloup's artificial leech were mechanical
  substitutes for the animal.
- Pierre Louis's numerical studies (1828, 1835) helped end routine bloodletting.
- Leeches are FDA-cleared today for reattached fingers and ears.
