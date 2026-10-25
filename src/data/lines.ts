// Every word the player sees, in one place: names, the title page, the stage notes, the
// ward's prompts and messages, the pause screen, the day's report, the register, the credits.
// Notes are in period voice; prompts and failures are short enough to read over a moving doctor.
// Edit freely — nothing here is logic. (Functions are for text with numbers or names in it.)

import type { StageId, PatientType } from '../config';

// ── Names ────────────────────────────────────────────────────────────────────

export const GAME_TITLE = 'Leechside Manor';

export const YEAR_TITLE: Record<number, string> = {
  1828: '1828 — the Salle Saint-Côme',
  1831: '1831 — the Salle Saint-Louis',
  1832: '1832 — the cholera',
};

export const WARD_NAME = {
  saintCome: 'Salle Saint-Côme',
  saintLouis: 'Salle Saint-Louis',
};

// Shown under a man's name in the ward and in the report.
export const TYPE_LABEL = {
  soldier: 'Soldier',
  anemic: 'Anemic',
  drummer: 'Drummer boy',
  nervous: 'Nervous conscript',
};

// What the cold, blue men are called each year.
export const COLD_LABEL: Record<number, string> = {
  1828: 'chilled',
  1831: 'chilled',
  1832: 'cholera',
};

// ── The title page ───────────────────────────────────────────────────────────

export const TITLE = {
  subtitle: 'Val-de-Grâce, Paris · three years under Broussais, 1828–1832',
  intro:
    'Broussais orders thirty leeches for every man, France buys them by the tens of millions, and you are his house physician. ' +
    'Bleed each soldier just enough — into the green zone — then bandage the bites. Don’t let them faint! ' +
    'Carry out anyone who does, salt the fed leeches, and watch your step when you run.',
  plateCaption: '“Le ixe chapitre contient le cas de Galerius … empereur des Rommains.”',
  begin: (year: number) => `Press E or Space to begin ${year}`,
  best: (francs: number) => `best ${francs} fr`,
  locked: 'not yet',
  soundOn: 'Sound on (M)',
  soundOff: 'Sound off (M)',
  menu: 'L — Leaderboard   ·   C — Credits',
  byline: 'originally created for Ludum Dare 60 · John Shen',
};

export interface Note {
  speaker: string;
  title: string;
  body: string[];
  hint?: string; // the mechanical point, in plain words
}

export const STAGE_NOTES: Record<StageId, Note> = {
  basics: {
    speaker: 'F.-J.-V. Broussais, Physician-in-Chief',
    title: 'February 1828. The Salle Saint-Côme.',
    body: [
      '“Thirty leeches, gentlemen, and a bandage once the man has bled enough. Every fever is an inflamed gut; bleed the gut and the fever goes.”',
    ],
    hint: 'Take leeches from the jar (up to three; E with a full hand puts them back) and set them on a man. The bar under his bed fills as he bleeds: take a bandage from the cupboard and bandage him in the GREEN ZONE. Fed leeches drop to the floor — don’t run over them! Sweep them into the salt bucket and they will eventually go back in the jar.',
  },
  frail: {
    speaker: 'Sister Marthe',
    title: 'Noon. The pale ones.',
    body: [
      '“They are bringing up the men from the fever ward, Monsieur. Mind the white-faced ones: they drop like sacks.”',
    ],
    hint: 'Anemic men with ashen faces have little blood to spare: their bar is short and they faint quickly. Use one leech and bandage them as soon as they reach the green zone.',
  },
  chill: {
    speaker: 'Sister Marthe',
    title: 'Three o’clock. The cold ones.',
    body: [
      '“The night watch is in from the frost, Monsieur, shivering fit to rattle the beds. I have had the orderlies bring up the stove and put the kettle on.”',
    ],
    hint: 'Chilled men (blanket to the chin, shivering, blue lips) take no leech until warmed: fill a hot-water bottle at the stove and tuck it in before trying to apply leeches.',
  },
  promotion: {
    speaker: 'F.-J.-V. Broussais',
    title: 'August 1831. The Salle Saint-Louis.',
    body: [
      '“You bled the Saint-Côme very prettily, Monsieur. Saint-Louis has seven beds and twice the traffic. And go easy with the jar: the cholera is in Hungary, the Austrians have closed the frontier, and Madame Ricard’s leeches come slowly.”',
    ],
    hint: 'Orderlies cross the aisles and won’t get out of your way: wait, or go around. Hungry leeches climb out of the jar and make for the drain — catch them. Deliveries are slower this year: salt the fed leeches and reuse them.',
  },
  machine: {
    speaker: 'A crate from the instrument-maker',
    title: 'Half past twelve. A modern miracle.',
    body: [
      '“With the compliments of Dr. Sarlandière: the bdellometer. A glass cup, a scarifier and a pump — the leech made obsolete.”',
    ],
    hint: 'The bdellometer is a pump that does a leech’s job. Carry it to a bed and HOLD E to pump. The bleeding stops the moment you let go, so he’ll wait in the green zone while you put it back on its stand and fetch a bandage.',
  },
  drummers: {
    speaker: 'Sister Marthe',
    title: 'Three o’clock. Boys and conscripts.',
    body: [
      '“The drummer boys are in, and the new conscripts. The little ones bleed like fountains, and the conscripts faint if you so much as look at a leech.”',
    ],
    hint: 'Drummer boys’ bites bleed on and on: one leech, and bandage them soon. Nervous conscripts panic when left alone: stand by them.',
  },
  cholera: {
    speaker: 'Madame Ricard, apothecary',
    title: 'April 1832. The cholera.',
    body: [
      '“The cholera is in Paris, Monsieur, and every hospital in the city is bleeding it. There is not a leech to be bought: what is in the jar is all you will have.”',
    ],
    hint: 'No deliveries this year. The leeches you start with are the only ones you have. Be quick about salting them and be strategic with the bdellometer. The cholera brings men in cold and blue — no leech will take until you warm them with a hot-water bottle from the stove.',
  },
  epidemic: {
    speaker: 'Sister Marthe',
    title: 'One o’clock. The epidemic.',
    body: [
      '“They are carrying them in from the street now, Monsieur. Every bed, as fast as it empties.”',
    ],
    hint: 'From now until the bell, patients arrive faster.',
  },
};

// On the title page (one line per ·) and in the first note.
export const CONTROLS = 'WASD / arrows: walk (Shift: run)  ·  E / Space: take, give, apply (hold to pump)  ·  Esc: pause  ·  M: mute';

export const VERB = {
  takeLeech: 'Take a leech',
  putBack: 'Put it back',
  putBackAll: 'Put them all back',
  takeBandage: 'Take a bandage',
  takeBottle: 'Fill a hot-water bottle',
  takeDevice: 'Take the bdellometer',
  apply: 'Apply leech',
  bandage: 'Apply bandage',
  warm: 'Tuck in the hot-water bottle',
  pump: 'Hold to pump',
  lift: 'Lift onto stretcher',
  deliver: 'Carry to recovery',
  salt: 'Salt them',
  scoop: 'Pick up',
  catch: 'Catch it',
} as const;
export type Verb = keyof typeof VERB;

export const FAIL = {
  handsFull: 'Hands full',
  jarEmpty: 'The jar is empty — wait for the next delivery',
  jarShortage: 'The jar is empty — salt fed leeches to refill it',
  full: 'Three leeches per man, at most',
  cold: 'Too cold for leeches — warm him with a hot-water bottle first',
  notCold: 'He’s warm enough',
  saltHungry: 'Only fed leeches go in the salt',
  usedOnPatient: 'Fed leeches go in the salt bucket',
  notDone: 'He’s fainted — carry him out',
  door: 'Only fainted men go out this door',
  stand: 'The bdellometer hasn’t arrived yet',
  scoopFull: 'Can’t hold any more',
  handful: 'You can only carry three',
  nothing: 'Nothing to do here',
} as const;
export type Fail = keyof typeof FAIL;

export const SAY = {
  ready: 'Ready for a bandage',
  warning: 'Enough!',
  faintBlood: 'Fainted! Carry him out',
  faintFright: 'Fainted from fright!',
  walkedOut: 'Tired of waiting',
  gaveUpQueue: 'Left without a bed',
  green: 'Just right',
  early: 'Too soon',
  late: 'Too much',
  escape: 'A leech is out!',
  latch: 'A leech climbed on!',
  drain: 'Down the drain',
  delivery: (n: number) => `+${n} leeches`,
  recycled: (n: number) => `${n} back in the jar`,
  slip: 'Slipped on a leech!',
  spilled: (count: number) => ` — ${count} spilled`,
  stoveArrives: 'The stove is brought up',
  deviceArrives: 'The bdellometer has come',
  warmed: 'Warmed — the leeches will take now',
  delivered: 'To the recovery ward',
  salted: (count: number) => `Salted ${count}`,
  jostle: 'Pardon, Monsieur!',
  collide: 'Ran into an orderly!',
  bell: 'The six o’clock bell',
};

// ── The ward ─────────────────────────────────────────────────────────────────

export const WARD = {
  doorSign: 'To the\nrecovery ward',
  queue: 'At the door',
  leaving: '(leaving!)', // after the name of a man about to give up waiting
  noDeliveries: 'No deliveries — salt fed leeches to reuse them',
  nextJar: (inSeconds: string) => `Next jar of leeches in ${inSeconds}`,
  salting: (count: number, inSeconds: string) => `${count} disgorging\nback in ${inSeconds}`,
  soundOff: 'sound off (M)',
  press: (verb: string) => `E  ${verb}`, // the prompt over the doctor's head
  hold: (verb: string) => `${verb} E`, // …for the bdellometer
  pumping: 'Pumping…',
  noteFooter: 'E / Space — back to the ward',
};

export const PAUSE = {
  speaker: 'The clock has stopped',
  title: 'Paused',
  status: (day: string, clock: string, francs: number) => `${day}, ${clock} — ${francs} francs so far.`,
  latency: (browser: string, speakers: string) => `Sound: ${browser} in the browser, ${speakers} to your speakers.`,
  latencyNone: 'Sound: not started yet.',
  keys: 'R: start the day again   ·   T: the title page   ·   M: sound on or off',
  footer: 'E / Space / Esc — carry on',
};

// ── The day's report ─────────────────────────────────────────────────────────

export const REPORT = {
  heading: (ward: string) => `${ward} — the day’s report`,
  subheading: (year: number) => `${year} · Val-de-Grâce military hospital · for the attention of the Physician-in-Chief`,
  nobody: 'Not a man treated.',
  more: (count: number) => `… and ${count} more`,
  kind: { anemic: '(anemic)', nervous: '(nervous)' } as Partial<Record<PatientType, string>>, // after a man's name; drummers say so in their rank
  green: 'Bled just right',
  earlyLate: 'Stopped early or late',
  faint: 'Fainted',
  walkedOut: 'Gave up waiting',
  applied: 'Leeches applied',
  lost: 'Leeches lost',
  squashed: (count: number) => ` (${count} squashed underfoot)`,
  floor: 'Fed leeches left on the floor',
  takings: (francs: number) => `Takings: ${francs} francs`,
  thresholds: (approved: number, noted: number) => `Approved at ${approved} fr · noted at ${noted} fr`,
  newBest: 'a new best for this day',
  stamp: { APPROVED: 'APPROVED', NOTED: 'NOTED', REPRIMAND: 'REPRIMAND' },
  signature: '— F.-J.-V. Broussais',
  next: (title: string) => `E / Space — ${title}`,
  epilogue: 'E / Space — what happened next',
  retry: 'R — this day again',
  title: 'T — title',
};

// ── The register (leaderboard) ───────────────────────────────────────────────

export const REGISTER = {
  prompt: (year: number) => `A place on the ${year} board! Sign the register:`,
  keys: 'Enter — sign   ·   Esc — leave it',
  unsigned: 'Left unsigned',
  signed: (place: string, year: number) => `Signed — ${place} for ${year}`,
  anonymous: 'Anonymous',
  heading: 'The Register',
  subheading: 'The best takings in the wards of the Val-de-Grâce — kept in this browser',
  empty: 'No names yet. Finish a year to sign the register.',
  back: 'E / Space / Esc — back',
};

// ── Credits ──────────────────────────────────────────────────────────────────

export const CREDITS = {
  heading: 'Credits',
  madeBy: `${GAME_TITLE} was developed for Ludum Dare 60 (“Old Tech”) by John Shen, using Claude AI.`,
  sections: [
    {
      head: 'Music',
      lines: [
        '“Ancient Rite” Kevin MacLeod (incompetech.com)',
        '“Vanishing” Kevin MacLeod (incompetech.com)',
        'Licensed under Creative Commons: By Attribution 4.0 License — http://creativecommons.org/licenses/by/4.0/',
      ],
    },
    {
      head: 'Sound effects',
      lines: [
        'All public domain (Creative Commons CC0); credit gladly given.',
        'Doors, cloth and footsteps: Kenney, RPG Audio and Impact Sounds (kenney.nl)',
        'Wet splats: Independent.nu, via qubodup — OpenGameArt',
        'Slow heartbeat: bart · Squelches and pops: EZduzziteh · Scissors: sinny · Boiling water: TinyWorlds — OpenGameArt',
        'Everything else synthesized in the browser with filtered noise and jsfxr.',
      ],
    },
    {
      head: 'Title plate',
      lines: [
        'The death of the emperor Galerius, eaten by worms. Boccaccio, Des cas des nobles hommes et femmes',
        '(trans. Laurent de Premierfait), Paris, 3rd quarter of the 15th century. BnF, Français 127, f. 258r. Source gallica.bnf.fr / BnF.',
      ],
    },
    {
      head: 'Type',
      lines: ['IM Fell English (Igino Marini) and EB Garamond (Georg Duffner, Octavio Pardo), SIL Open Font License.'],
    },
  ],
  back: 'E / Space / Esc — back',
};

export const VERDICT_REMARK = {
  APPROVED: '“Exemplary. The guts of the garrison are soothed and Madame Ricard is delighted. Carry on, Monsieur.”',
  NOTED: '“Noted. Adequate bleeding, inadequate zeal. Thirty leeches, Monsieur — thirty.”',
  REPRIMAND: '“Men fainting in the corridors, leeches in the drains. See me in the morning.”',
};

// After 1832, on its own page: what really happened, in plain English. `francs` is the
// three years' takings (or 1832's alone, if the run didn't start in 1828).
export const FINAL_REMARK = {
  heading: 'What happened next',
  history: [
    'Cholera killed about 18,000 people in Paris in 1832. It could kill by draining the body of water and salts. Bloodletting could make that dangerous fluid loss worse. Leeches could not cure cholera.',
    'Meanwhile, a Paris doctor named Pierre Louis was challenging medical certainty with numbers. He compared pneumonia patients and in 1835 published an expanded study questioning how much bloodletting really helped. He still believed it had some uses, but his work became an early contribution to evidence-based medicine.',
    'Broussais’s influence waned. France had been importing tens of millions of leeches a year; imports fell sharply overall in the years after 1832. The leech population in parts of Europe never recovered.',
  ],
  money: (francs: number) =>
    francs > 0
      ? `Good thing you made ${francs} francs, because the leech business is drying up and you’ll need a new job.`
      : `You finish ${-francs} francs in debt, just as the leech business dries up. Have you considered the law?`,
  coda: 'The leeches, at least, made a comeback. Surgeons found a use for them in relieving blood pooled in damaged tissue after reconstructive surgery. In 2004, the US Food and Drug Administration cleared medicinal leeches for this purpose.',
  footer: 'E / Space — the title page',
};

export const OUTCOME_LABEL: Record<string, string> = {
  green: 'bled just right',
  early: 'stopped too soon',
  late: 'bled too long',
  faint: 'fainted',
  walkedOut: 'gave up waiting',
  unfinished: 'handed to the night',
};
