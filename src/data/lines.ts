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
    title: '8 o’clock. The Salle Saint-Côme.',
    body: [
      '“Thirty leeches, gentlemen, and lint when they drop. Every fever is an inflamed gut; bleed the gut and the fever goes.”',
    ],
    hint: 'Take leeches from Madame Ricard’s jar (up to three; E again with a full hand puts them back) and set them on a man. The bar under his bed fills as he bleeds: press lint from the cupboard on him in the GREEN. Fed leeches fall to the floor; sweep them into the salt bucket.',
  },
  frail: {
    speaker: 'Sister Marthe',
    title: '10 o’clock. The pale ones.',
    body: [
      '“They are bringing up the men from the fever ward, Monsieur. Mind the white-faced ones: they drop like sacks.”',
    ],
    hint: 'Anaemic men (ashen faces) have a narrow green and faint soon after it (Prop. 268). One leech and patience — their bites keep bleeding.',
  },
  stubborn: {
    speaker: 'Madame Ricard, apothecary',
    title: 'Noon. A temperamental lot.',
    body: [
      '“This lot are sulking. A curled leech won’t bite cold skin — warm him first with a dab of sugar-water. And mind the lid: the hungry ones wander.”',
    ],
    hint: 'A curled, frowning leech needs the patient dabbed with sugar-water from the kettle first — or put it back and draw another. Escaped leeches crawl for the drain: catch them.',
  },
  machine: {
    speaker: 'A crate from the instrument-maker',
    title: 'Half past one. A modern miracle.',
    body: [
      '“With the compliments of Dr. Sarlandière: the bdellometer. A glass cup, a scarifier and a pump — the leech made obsolete.”',
    ],
    hint: 'Carry the bdellometer to a bed and HOLD E to pump. Let go to stop at once; it leaves no after-bleed — but it needs both your hands.',
  },
  shortage: {
    speaker: 'Madame Ricard',
    title: '3 o’clock. The great shortage.',
    body: [
      '“The Hungarian shipment is late. There is not a leech left in Paris — the cholera wards bought them all.”',
    ],
    hint: 'Deliveries stop for a while (see the countdown). Salted leeches go back in the jar. Drummer boys bleed on and on (Prop. 266); nervous conscripts faint from fright unless you stand by them.',
  },
};

export const CONTROLS = 'WASD / arrows: walk  ·  E / Space: take, give, apply (hold to pump)  ·  Esc: pause  ·  M: mute';

export const VERB = {
  takeLeech: 'Take a leech',
  putBack: 'Put it back',
  putBackSulky: 'Put the stubborn one back',
  putBackAll: 'Put them all back',
  takeLint: 'Take lint',
  takeSugar: 'Take sugar-water',
  takeDevice: 'Take the bdellometer',
  apply: 'Apply leech',
  bandage: 'Press lint',
  prepare: 'Dab sugar-water',
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
  jarShortage: 'No leeches — the shipment is late',
  full: 'Three is plenty',
  refused: 'Too cold for him — sugar-water first',
  prepared: 'Already warmed',
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
  shortageWarning: 'No deliveries soon — the shipment is late',
  shortageStart: 'No leeches until the shipment',
  shortageEnd: 'Madame Ricard’s boy is here with the jar',
  bell: 'The six o’clock bell',
};

export const VERDICT_REMARK = {
  APPROVED: '“Exemplary. The guts of the garrison are soothed and Madame Ricard is delighted. Carry on, Monsieur.”',
  NOTED: '“Noted. Adequate bleeding, inadequate zeal. Thirty leeches, Monsieur — thirty.”',
  REPRIMAND: '“Men fainting in the corridors, leeches in the drains. See me in the morning.”',
};

export const OUTCOME_LABEL: Record<string, string> = {
  green: 'bled just right',
  early: 'stopped too soon',
  late: 'bled too long',
  faint: 'fainted',
  walkedOut: 'gave up waiting',
  unfinished: 'handed to the night',
};
