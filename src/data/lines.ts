// Everything the ward says. Notes arrive in period voice; prompts and failures
// are short enough to read over a moving doctor.

import type { StageId } from '../config';

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
      '“Thirty leeches, gentlemen, and lint when they drop. Every fever is an inflamed gut; bleed the gut and the fever goes.”',
    ],
    hint: 'Take leeches from Madame Ricard’s jar (up to three; E with a full hand puts them back) and set them on a man. The bar under his bed fills as he bleeds: press lint from the cupboard on him in the GREEN. Fed leeches drop to the floor — don’t run over them! Sweep them into the salt bucket and they go back in the jar.',
  },
  frail: {
    speaker: 'Sister Marthe',
    title: 'Noon. The pale ones.',
    body: [
      '“They are bringing up the men from the fever ward, Monsieur. Mind the white-faced ones: they drop like sacks.”',
    ],
    hint: 'Anaemic men (ashen faces) have a narrow green and faint soon after it (Prop. 268). One leech and patience — their bites keep bleeding.',
  },
  chill: {
    speaker: 'Sister Marthe',
    title: 'Three o’clock. The cold ones.',
    body: [
      '“The night watch is in from the frost, Monsieur, shivering fit to rattle the beds. I have had the orderlies bring up the stove and put the kettle on.”',
    ],
    hint: 'Chilled men (blanket to the chin, shivering, blue lips) take no leech until warmed: fill a hot-water bottle at the stove and tuck it in, then bleed them.',
  },
  promotion: {
    speaker: 'F.-J.-V. Broussais',
    title: 'August 1831. The Salle Saint-Louis.',
    body: [
      '“You bled the Saint-Côme very prettily, Monsieur. Saint-Louis has seven beds and twice the traffic. And go easy with the jar: the cholera is in Hungary, the Austrians have closed the frontier, and Madame Ricard’s leeches come slowly.”',
    ],
    hint: 'Orderlies cross the aisles and won’t give way: wait, or go round. Hungry leeches climb out of the jar and make for the drain — catch them. Deliveries are slower this year: salt the fed leeches and reuse them. Chilled men still come in, shaking with fever: warm them at the stove first.',
  },
  machine: {
    speaker: 'A crate from the instrument-maker',
    title: 'Half past twelve. A modern miracle.',
    body: [
      '“With the compliments of Dr. Sarlandière: the bdellometer. A glass cup, a scarifier and a pump — the leech made obsolete.”',
    ],
    hint: 'Carry the bdellometer to a bed and HOLD E to pump. Let go to stop at once; it leaves no after-bleed — but it needs both your hands.',
  },
  drummers: {
    speaker: 'Sister Marthe',
    title: 'Three o’clock. Boys and conscripts.',
    body: [
      '“The drummer boys are in, and the new conscripts. The little ones bleed like fountains, and the conscripts faint if you so much as look at a leech.”',
    ],
    hint: 'Drummer boys’ bites bleed on and on (Prop. 266): one leech, and lint soon. Nervous conscripts panic when left alone: stand by them.',
  },
  cholera: {
    speaker: 'Madame Ricard, apothecary — and Broussais',
    title: 'April 1832. The cholera.',
    body: [
      '“The cholera is in Paris, Monsieur, and every hospital in the city is bleeding it. There is not a leech to be bought: what is in the jar is all you will have.”',
      '“A gastro-enteritis like any other, gentlemen. Leeches to the belly.” — Broussais',
    ],
    hint: 'No deliveries this year: salted leeches go back in the jar, and the bdellometer is on its stand. The cholera brings men in cold and blue — no leech will take until you warm them with a hot-water bottle from the stove.',
  },
  epidemic: {
    speaker: 'Sister Marthe',
    title: 'One o’clock. The epidemic.',
    body: [
      '“They are carrying them in from the street now, Monsieur. Every bed, as fast as it empties.”',
    ],
    hint: 'Men arrive faster for the rest of the day.',
  },
};

export const CONTROLS = 'WASD / arrows: walk (Shift: run)  ·  E / Space: take, give, apply (hold to pump)  ·  Esc: pause  ·  M: mute';

export const VERB = {
  takeLeech: 'Take a leech',
  putBack: 'Put it back',
  putBackAll: 'Put them all back',
  takeLint: 'Take lint',
  takeBottle: 'Fill a hot-water bottle',
  takeDevice: 'Take the bdellometer',
  apply: 'Apply leech',
  bandage: 'Press lint',
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
  jarEmpty: 'The jar is empty',
  jarShortage: 'Empty — salt the fed ones to refill it',
  full: 'Three is plenty',
  cold: 'He’s cold and blue — no leech will take. Warm him with a hot-water bottle first',
  notCold: 'He’s warm enough',
  saltHungry: 'Salt is for the fed ones',
  usedOnPatient: 'To the salt bucket with those',
  notDone: 'Not that — he needs carrying',
  door: 'Only for the fainted',
  stand: 'Reserved for Dr. Sarlandière’s instrument',
  scoopFull: 'Can’t hold any more',
  handful: 'Three is a handful',
  nothing: 'Nothing to do here',
} as const;
export type Fail = keyof typeof FAIL;

export const SAY = {
  ready: 'Ready for lint',
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
  jostle: 'Pardon, Monsieur!',
  collide: 'Ran into an orderly!',
  bell: 'The six o’clock bell',
};

export const VERDICT_REMARK = {
  APPROVED: '“Exemplary. The guts of the garrison are soothed and Madame Ricard is delighted. Carry on, Monsieur.”',
  NOTED: '“Noted. Adequate bleeding, inadequate zeal. Thirty leeches, Monsieur — thirty.”',
  REPRIMAND: '“Men fainting in the corridors, leeches in the drains. See me in the morning.”',
};

// After the third year: what became of it all.
export const FINAL_REMARK =
  '“Physiological medicine never fails, Monsieur.” It did: the cholera killed some eighteen thousand Parisians in 1832, bleeding saved none of them, and from that year Broussais’s star — and France’s leech imports — began to fall.';

export const OUTCOME_LABEL: Record<string, string> = {
  green: 'bled just right',
  early: 'stopped too soon',
  late: 'bled too long',
  faint: 'fainted',
  walkedOut: 'gave up waiting',
  unfinished: 'handed to the night',
};
