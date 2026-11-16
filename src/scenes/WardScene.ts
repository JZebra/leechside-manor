// The ward: reads the keyboard, steps the Ward model, and draws it. All rules
// live in src/model; this file only turns state and events into pixels and sound.
// Playing online, the server steps the model: this scene moves its own doctor at once,
// sends the server where he is and what he presses, and draws the snapshots it sends back.

import Phaser from 'phaser';
import { CONFIG } from '../config';
import { PIXEL, hex, type PaletteKey } from '../art/palette';
import { ensurePatientTexture, LEECH_SLOTS, SATED, COAT_TAGS, escapeKey, escapeDir, handKey, type PatientLook, type Hat, type Outfit, type Blanket } from '../art/sprites';
import { Ward, type WardEvent, type Target, type Hand, type Doctor } from '../model/ward';
import type { Patient } from '../model/patient';
import { BED, WORLD, type Layout, type StationId, type Rect } from '../model/layout';
import { STAGE_NOTES, VERB, FAIL, SAY, CONTROLS, WARD, PAUSE, ONLINE, type Note } from '../data/lines';
import { sfx, audioDebug } from '../audio/audio';
import { playMusic } from '../audio/music';
import { FLAGS } from '../flags';
import { fitCamera, text, sprite, place, panel, STAGE, RES } from '../ui/view';
import { soundButton } from '../ui/sound';
import { applySnapshot, type PatientRecord } from '../net/snapshot';
import { session, type NetClient } from '../net/client';
import type { Report, Seat } from '../net/protocol';

const P = PIXEL;
const DEPTH = { floor: 0, floorItem: 2, world: 10, overlay: 9000, prompt: 9500, say: 9600, hud: 10000, note: 20000 };
type Tone = 'good' | 'bad' | 'info' | 'cold';
const TONE: Record<Tone, PaletteKey> = { good: 'meterGreen1', bad: 'red3', info: 'paper0', cold: 'meterBlue1' };
// A full meter is the hardiest man's faint, so every bar shares one scale.
const METER_SCALE = Math.max(...Object.values(CONFIG.patient.types).map((t) => t.faintAt));

interface BedView {
  patient: Phaser.GameObjects.Image;
  leeches: Phaser.GameObjects.Image[];
  bites: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Image;
  warm: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  labelKey: string;
}

interface QueueView {
  head: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
}

interface DoctorView {
  body: Phaser.GameObjects.Image;
  stars: Phaser.GameObjects.Image;
  carry: Phaser.GameObjects.Image;
  count: Phaser.GameObjects.Text;
  device: Phaser.GameObjects.Image;
  tag: Phaser.GameObjects.Text | null; // his name, playing online
  coat: number;
  shown: { x: number; y: number }; // where he's drawn: a colleague glides towards each snapshot
}

// A game online, as the lobby hands it over.
export interface OnlineGame {
  net: NetClient;
  day: number;
  seed: string;
  seats: Seat[];
}

interface Online extends OnlineGame {
  me: number; // this player's doctor
  records: Map<number, PatientRecord>;
  report: Report | null;
  stop: (() => void)[];
  sentAt: number;
  sent: string; // the last position sent, so standing still costs nothing
  pumping: boolean;
  toResults: boolean; // the bell has rung: off to the report as soon as it arrives
}

type Keys = Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'E' | 'SPACE' | 'SHIFT', Phaser.Input.Keyboard.Key>;

// What a man wears, from his record (with plain defaults for anything missing).
export interface Wardrobe { skin: string; hair: string; moustache: boolean; beard?: boolean; hat?: Hat; outfit?: Outfit; blanket?: Blanket }
const wardrobe = (pt: Wardrobe) => ({ beard: !!pt.beard, hat: pt.hat ?? 'none', outfit: pt.outfit ?? 'shirt', blanket: pt.blanket ?? 'army' });

export function lookOf(p: Patient): PatientLook {
  const pt = p.profile.portrait as unknown as Wardrobe;
  return {
    ...wardrobe(pt),
    skin: pt.skin,
    hair: p.type === 'drummer' ? 'hairBrown' : pt.hair,
    moustache: pt.moustache && p.type !== 'drummer',
    build: p.type === 'anemic' ? 'thin' : p.type === 'drummer' ? 'small' : 'normal',
    pallor: p.pallorRung(),
    eyes: p.state === 'fainted' ? 'closed' : p.type === 'nervous' ? 'wide' : 'open',
    sweat: p.active && ((p.type === 'nervous' && p.panic > 0.4) || p.zone() === 'blue'),
    cold: p.active && p.chilled,
  };
}

export class WardScene extends Phaser.Scene {
  ward!: Ward;
  private keys!: Keys;
  private t = 0;
  private bedViews: BedView[] = [];
  private queueViews: QueueView[] = [];
  private stations = {} as Record<StationId, Phaser.GameObjects.Image>;
  private floorSprites = new Map<number, Phaser.GameObjects.Image>();
  private escapeeSprites = new Map<number, Phaser.GameObjects.Image>();
  private trail: { x: number; y: number; t: number }[] = [];
  private trailIn = 0;
  private docViews: DoctorView[] = [];
  private online: Online | null = null;
  private me = 0; // the doctor this screen moves
  private zoom = 1; // the world on screen, against a one-doctor ward (⅔ in the Grande Salle)
  private uiCam: Phaser.Cameras.Scene2D.Camera | null = null;
  private toast: { view: Phaser.GameObjects.Container; until: number } | null = null;
  private leaveView: Phaser.GameObjects.Container | null = null;
  private gMeters!: Phaser.GameObjects.Graphics;
  private gHighlight!: Phaser.GameObjects.Graphics;
  private gTrail!: Phaser.GameObjects.Graphics;
  private prompt!: Phaser.GameObjects.Text;
  private hud!: { clock: Phaser.GameObjects.Text; money: Phaser.GameObjects.Text; jar: Phaser.GameObjects.Text; banner: Phaser.GameObjects.Text; jarLabel: Phaser.GameObjects.Text; salt: Phaser.GameObjects.Text; queue: Phaser.GameObjects.Text };
  private notes: Note[] = [];
  private noteView: Phaser.GameObjects.Container | null = null;
  private noteShownAt = 0;
  private paused = false;
  private pumpBed: number | null = null;
  private pumpTime = 0;
  private pumpSoundIn = 0;
  private ending = false;
  private recentSays: { x: number; y: number; t: number }[] = [];
  private dayIndex = 0;
  private orderlySprites = new Map<number, Phaser.GameObjects.Image>();
  private stepIn = 0; // seconds to the next footstep
  private heartIn = 0; // seconds to the next heartbeat

  constructor() {
    super('ward');
  }

  init(data: { day?: number; online?: OnlineGame }) {
    const o = data?.online;
    this.dayIndex = Math.max(0, Math.min(CONFIG.days.length - 1, o?.day ?? data?.day ?? FLAGS.day ?? 0));
    this.online = o
      ? { ...o, me: o.seats.find((s) => s.id === o.net.you)?.doctor ?? 0, records: new Map(), report: null, stop: [], sentAt: 0, sent: '', pumping: false, toResults: false }
      : null;
    this.me = this.online?.me ?? 0;
  }

  // This screen's own doctor.
  private get mine(): Doctor {
    return this.ward.doctors[this.me];
  }

  private get L(): Layout {
    return this.ward.layout;
  }

  create() {
    fitCamera(this);
    playMusic('ward');
    const o = this.online;
    this.ward = o
      ? new Ward(o.seed, o.day, { doctors: o.seats.length, ward: CONFIG.multi.ward }) // a mirror of the server's
      : new Ward(FLAGS.seed ?? String(Date.now()), this.dayIndex);
    (window as unknown as { ward: Ward }).ward = this.ward;
    this.t = 0;
    this.notes = [];
    this.noteView = null;
    this.paused = false;
    this.ending = false;
    this.bedViews = [];
    this.queueViews = [];
    this.floorSprites.clear();
    this.escapeeSprites.clear();
    this.orderlySprites.clear();
    this.trail = [];
    this.recentSays = [];
    this.docViews = [];
    this.toast = null;
    this.leaveView = null;

    this.stepIn = 0;
    this.heartIn = 0;

    this.fitWorld();
    this.buildRoom();
    this.buildHud();
    this.bindKeys();

    if (o) this.listen(o);
    else if (FLAGS.stage) this.handle(this.ward.skipTo(FLAGS.stage));
  }

  // A ward bigger than the screen (the Grande Salle) is shown zoomed out, on the same pixel
  // grid at two-thirds the size; a second camera keeps the HUD and the notes full size.
  private fitWorld() {
    const world = this.L.world;
    this.zoom = WORLD.w / world.w;
    this.uiCam = null;
    if (this.zoom === 1) return;
    const main = this.cameras.main;
    main.setZoom(RES * this.zoom);
    main.centerOn((world.w * P) / 2, (world.h * P) / 2);
    this.uiCam = this.cameras.add(0, 0, main.width, main.height).setZoom(RES);
    this.uiCam.centerOn(STAGE.w / 2, STAGE.h / 2);
  }

  // Each object to one camera: the HUD and notes to the full-size one, the ward to the
  // zoomed one — its words scaled back up so they read the same as in a one-doctor ward.
  private sortCameras() {
    const ui = this.uiCam;
    if (!ui) return;
    const main = this.cameras.main;
    for (const o of this.children.list) {
      const hud = (o as unknown as { depth: number }).depth >= DEPTH.hud;
      o.cameraFilter = hud ? main.id : ui.id;
      if (!hud && o instanceof Phaser.GameObjects.Text) o.setScale(1 / this.zoom);
    }
  }

  // The server's half of the conversation.
  private listen(o: Online) {
    o.stop.push(
      o.net.release((m) => {
        if (m.t === 'snap') {
          applySnapshot(this.ward, m.s, o.records, o.me);
          this.handle(m.ev);
        } else if (m.t === 'over') {
          o.report = m.report;
          if (o.toResults) this.toResults();
        }
      }),
      o.net.onTrouble((t) => {
        this.scene.start('together', { trouble: t });
      }),
    );
    this.events.once('shutdown', () => o.stop.forEach((f) => f()));
  }

  // ── Construction ──────────────────────────────────────────────────────────

  private buildRoom() {
    const L = this.L;
    const world = L.world;
    this.add.tileSprite(0, world.wall * P, world.w, world.h - world.wall, 'floor').setOrigin(0).setScale(P).setDepth(DEPTH.floor);
    this.add.tileSprite(0, 0, world.w, world.wall, 'wall').setOrigin(0).setScale(P).setDepth(DEPTH.floor);
    for (const x of L.windows) sprite(this, 'window', x, 3).setDepth(DEPTH.floor + 1);
    sprite(this, 'drain', L.drain.x - 6, L.drain.y - 4).setDepth(DEPTH.floor + 1);
    // openings in the side walls where the orderlies come and go
    const gd = this.add.graphics().setDepth(DEPTH.floor + 1);
    for (const route of L.routes) {
      for (const end of [route[0], route[route.length - 1]]) {
        const x = end.x < world.w / 2 ? 0 : world.w - 4;
        gd.fillStyle(hex('ink')).fillRect(x * P, (end.y - 22) * P, 4 * P, 26 * P);
        gd.fillStyle(hex('wood1')).fillRect((x + (x ? 0 : 3)) * P, (end.y - 22) * P, P, 26 * P);
      }
    }
    this.gTrail = this.add.graphics().setDepth(DEPTH.floorItem - 1);

    for (const id of Object.keys(L.stations) as StationId[]) {
      const s = L.stations[id];
      this.stations[id] = sprite(this, s.tex, s.box.x, s.box.y).setDepth(id === 'door' ? DEPTH.floor + 1 : DEPTH.world + s.box.y + s.box.h);
    }
    text(this, (L.stations.door.box.x - 2) * P, 6 * P, WARD.doorSign, { size: 15, italic: true, color: 'paper0', stroke: 'ink', strokeWidth: 4, align: 'right' })
      .setOrigin(1, 0)
      .setDepth(DEPTH.floor + 2);

    L.beds.forEach((b, i) => {
      const depth = DEPTH.world + b.y + BED.h;
      sprite(this, 'bed', b.x, b.y).setDepth(depth - 0.5);
      const view: BedView = {
        patient: sprite(this, 'bed', b.x, b.y).setDepth(depth - 0.4).setVisible(false),
        leeches: LEECH_SLOTS.map(() => sprite(this, 'leech:0').setDepth(depth - 0.2).setVisible(false)),
        bites: this.add.graphics().setDepth(depth - 0.3),
        icon: sprite(this, 'icon:ready').setDepth(DEPTH.overlay).setVisible(false),
        warm: sprite(this, 'icon:warm').setDepth(depth - 0.1).setVisible(false),
        label: text(this, (b.x + BED.w / 2) * P, (b.y + BED.h + 7) * P, '', { size: 15, color: 'linen1', stroke: 'ink', strokeWidth: 4, align: 'center' })
          .setOrigin(0.5, 0).setDepth(DEPTH.overlay),
        labelKey: '',
      };
      this.bedViews[i] = view;
    });

    this.gMeters = this.add.graphics().setDepth(DEPTH.overlay);
    this.gHighlight = this.add.graphics().setDepth(DEPTH.prompt);
    this.ward.doctors.forEach((d) => {
      const seat = this.online?.seats.find((s) => s.doctor === d.id);
      const coat = seat?.slot ?? d.id;
      this.docViews.push({
        body: sprite(this, `doc:${coat}:down:0`),
        stars: sprite(this, 'daze:0').setDepth(DEPTH.prompt).setVisible(false),
        carry: sprite(this, 'item:bandage').setVisible(false),
        count: text(this, 0, 0, '', { size: 16, color: 'paper0', stroke: 'ink', strokeWidth: 4, bold: true }).setDepth(DEPTH.prompt),
        device: sprite(this, 'cup:0:0').setVisible(false),
        tag: seat ? text(this, 0, 0, seat.name, { size: 14, italic: true, color: COAT_TAGS[coat], stroke: 'ink', strokeWidth: 4 }).setOrigin(0.5, 1).setDepth(DEPTH.prompt - 1) : null,
        coat,
        shown: { x: d.x, y: d.y },
      });
    });
    this.prompt = text(this, 0, 0, '', { size: 17, color: 'paper0', stroke: 'ink', strokeWidth: 5 }).setOrigin(0.5, 1).setDepth(DEPTH.prompt);
  }

  private buildHud() {
    const g = this.add.graphics().setDepth(DEPTH.hud);
    panel(g, 936, 9, 330, 54, 'paper1');
    g.fillStyle(hex('paper3')).fillRect(1203, 18, P, 36); // a rule before the sound button
    const jar = this.L.stations.jar.box;
    const bucket = this.L.stations.bucket.box;
    this.hud = {
      clock: text(this, 952, 36, '8:00', { font: 'display', size: 34 }).setOrigin(0, 0.5).setDepth(DEPTH.hud),
      money: text(this, 1070, 36, '0 fr', { font: 'display', size: 28, color: 'red1' }).setOrigin(0.5).setDepth(DEPTH.hud),
      jar: text(this, 1192, 36, '8', { font: 'display', size: 28 }).setOrigin(1, 0.5).setDepth(DEPTH.hud),
      banner: text(this, 600, 36, '', { size: 19, color: 'paper0', stroke: 'ink', strokeWidth: 5, align: 'center' }).setOrigin(0.5).setDepth(DEPTH.hud),
      jarLabel: text(this, (jar.x + jar.w / 2) * P, (jar.y + 17.5) * P, '8', { font: 'display', size: 24 }).setOrigin(0.5).setDepth(DEPTH.world + 200),
      salt: text(this, (bucket.x + 10) * P, (bucket.y + 20) * P, '', { size: 14, italic: true, color: 'linen1', stroke: 'ink', strokeWidth: 4, align: 'center' }).setOrigin(0.5, 0).setDepth(DEPTH.overlay),
      queue: text(this, 6 * P, 30 * P, WARD.queue, { size: 15, italic: true, color: 'paper0', stroke: 'ink', strokeWidth: 4 }).setDepth(DEPTH.overlay),
    };
    sprite(this, 'item:leech', 1116 / P, 25 / P).setDepth(DEPTH.hud);
    soundButton(this, { x: 1257, y: 18, depth: DEPTH.note + 1 }); // above the notes and the pause, so it works there too
    if (this.online) text(this, 1262, 690, ONLINE.room(this.online.net.code), { size: 15, italic: true, color: 'paper2', stroke: 'ink', strokeWidth: 3 }).setOrigin(1, 0).setDepth(DEPTH.hud);
    for (let i = 0; i < 6; i++) {
      const ay = 38 + i * 26;
      this.queueViews.push({
        head: sprite(this, 'bed', 6, ay).setDepth(DEPTH.overlay).setVisible(false),
        name: text(this, 31 * P, (ay + 2) * P, '', { size: 14, color: 'linen1', stroke: 'ink', strokeWidth: 4 }).setDepth(DEPTH.overlay),
      });
    }
  }

  private bindKeys() {
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,SHIFT') as Keys;
    kb.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    // E / Space / Enter act on the browser's keydown at once (Phaser would deliver it on the
    // next game step, and drops a tap whose keyup lands in the same frame).
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat && (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter')) this.press();
    };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
    kb.on('keydown-ESC', () => (this.online ? this.toggleLeave() : this.togglePause()));
    kb.on('keydown-P', () => !this.online && this.togglePause());
    kb.on('keydown-R', () => {
      if (this.paused) this.scene.restart({ day: this.dayIndex });
    });
    kb.on('keydown-T', () => {
      if (this.paused) this.scene.start('title');
    });
  }

  // ── Loop ──────────────────────────────────────────────────────────────────

  update(_time: number, deltaMs: number) {
    const real = Math.min(deltaMs / 1000, 0.1);
    this.t += real;
    if (this.online) return this.updateOnline(real, this.online);
    const k = this.keys;
    if (this.noteView) {
      this.render();
      return;
    }
    if (this.paused || this.ending) {
      this.render();
      return;
    }
    if (this.notes.length) {
      this.showNote(this.notes.shift()!);
      this.render();
      return;
    }

    const ward = this.ward;
    const dt = real * FLAGS.fast;
    const events: WardEvent[] = [];

    // hold E with the bdellometer on a bed: pump, and stand still
    this.pumpBed = null;
    const held = k.E.isDown || k.SPACE.isDown;
    if (held && ward.hand?.kind === 'bdello') {
      const tg = ward.target();
      if (tg?.check.ok && tg.check.verb === 'pump' && tg.target.kind === 'bed') this.pumpBed = tg.target.bed;
    }
    if (this.pumpBed != null) {
      ward.doctor.moving = false;
      events.push(...ward.pump(this.pumpBed, dt));
      this.pumpTime += dt;
      this.pumpSoundIn -= real;
      if (this.pumpSoundIn <= 0) {
        sfx('pump');
        this.pumpSoundIn = 0.42;
      }
    } else {
      this.pumpTime = 0;
      this.pumpSoundIn = 0;
      const ix = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const iy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      events.push(...ward.walk(ix, iy, real, k.SHIFT.isDown));
    }

    events.push(...ward.tick(dt));
    this.ambience(real);
    this.handle(events);
    this.render();
  }

  // Online: no pausing for notes (they come as cards in the corner), and the clock is the
  // server's. Move our doctor, tell the server, hold the pump if E is held on a bed.
  private updateOnline(real: number, o: Online) {
    const now = performance.now() / 1000; // cards last by the clock on the wall, however slow the frames
    if (this.notes.length && (!this.toast || now > this.toast.until)) this.showToast(this.notes.shift()!);
    if (this.toast && now > this.toast.until) {
      this.toast.view.destroy();
      this.toast = null;
    }
    const k = this.keys;
    const d = this.mine;
    const free = !this.ending && !this.leaveView && d.dazed <= 0;
    this.pumpBed = null;
    if (free && (k.E.isDown || k.SPACE.isDown) && d.hand?.kind === 'bdello') {
      const tg = this.ward.target(this.me);
      if (tg?.check.ok && tg.check.verb === 'pump' && tg.target.kind === 'bed') this.pumpBed = tg.target.bed;
    }
    const pumping = this.pumpBed != null;
    if (pumping !== o.pumping) o.net.send({ t: 'pump', on: (o.pumping = pumping) });
    let ix = 0;
    let iy = 0;
    if (pumping) {
      d.moving = false;
      this.pumpTime += real;
      this.pumpSoundIn -= real;
      if (this.pumpSoundIn <= 0) {
        sfx('pump');
        this.pumpSoundIn = 0.42;
      }
    } else {
      this.pumpTime = 0;
      this.pumpSoundIn = 0;
      if (free) {
        ix = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
        iy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      }
      this.ward.glide(ix, iy, real, k.SHIFT.isDown, this.me);
    }
    // where he is, twenty times a second, while anything changes (or he pushes against something)
    const run = d.running;
    const state = `${d.x.toFixed(1)},${d.y.toFixed(1)},${d.facing},${d.flip},${run}`;
    if (this.t - o.sentAt >= 0.05 && (state !== o.sent || ix || iy)) {
      o.net.send({ t: 'move', x: d.x, y: d.y, run, facing: d.facing, flip: d.flip, ix, iy });
      o.sent = state;
      o.sentAt = this.t;
    }
    this.ambience(real);
    this.render();
  }

  // Sounds that follow the state of the ward rather than single events: the doctor's
  // footsteps, and a slow heartbeat while any man is near fainting.
  private ambience(real: number) {
    const ward = this.ward;
    const d = this.mine;
    if (d.moving && d.dazed <= 0) {
      this.stepIn -= real;
      if (this.stepIn <= 0) {
        sfx('footstep');
        this.stepIn = (d.hand?.kind === 'stretcher' ? 0.42 : 0.3) / (d.running ? 1.6 : 1);
      }
    } else this.stepIn = 0.08; // the first step lands just after he sets off

    // the worst man in the blue sets the beat: slower and lower the nearer he is to fainting
    let worst = -1;
    for (const b of ward.beds) {
      const p = b.patient;
      if (!p?.active || b.leaving > 0 || p.zone() !== 'blue') continue;
      const [, g1] = p.spec.green;
      worst = Math.max(worst, Math.min(1, (p.blood - g1) / (p.spec.faintAt - g1)));
    }
    if (worst >= 0) {
      this.heartIn -= real;
      if (this.heartIn <= 0) {
        const rate = 1 - 0.18 * worst;
        sfx('heartbeat', { rate, vol: 0.55 + 0.45 * worst });
        this.heartIn = 1.35 / rate + 0.45 * worst;
      }
    } else this.heartIn = 0;
  }

  // One press of E: dismiss a note, or act on the target right now (its sound plays at once).
  private press() {
    if (!this.scene.isActive()) return;
    if (this.online) {
      if (this.leaveView) return this.leave();
      const tg = this.ending ? null : this.ward.target(this.me);
      if (tg && !(tg.check.ok && tg.check.verb === 'pump')) this.online.net.send({ t: 'press' });
      return;
    }
    if (this.noteView) {
      if (this.t - this.noteShownAt > 0.35) this.closeNote();
      return;
    }
    if (this.paused || this.ending || this.notes.length) return;
    const tg = this.ward.target();
    if (tg && !(tg.check.ok && tg.check.verb === 'pump')) this.handle(this.ward.interact(tg.target));
  }

  // ── Events → sound and words ──────────────────────────────────────────────

  private handle(events: WardEvent[]) {
    const ward = this.ward;
    for (const e of events) {
      switch (e.kind) {
        case 'stage':
          if (FLAGS.notes) this.notes.push(STAGE_NOTES[e.id]);
          break;
        case 'knock':
          sfx('thud');
          sfx('grunt');
          this.say(SAY.knock, e.x, e.y, 'bad');
          break;
        case 'stoveArrives':
          sfx('door');
          this.sayAt(this.L.stations.stove.box, SAY.stoveArrives, 'info');
          break;
        case 'deviceArrives':
          this.sayAt(this.L.stations.stand.box, SAY.deviceArrives, 'info');
          break;
        case 'arrive':
          sfx('door', { minGap: 0.3 });
          break;
        case 'gaveUp':
          sfx('doorClose');
          if (e.bed != null) this.sayAt(this.ward.bedRect(e.bed), `${SAY.walkedOut} ${e.fee} fr`, 'bad');
          else this.say(`${SAY.gaveUpQueue} ${e.fee} fr`, 20, 40, 'bad');
          break;
        case 'take':
          if (e.what === 'bandage') sfx('cloth');
          else if (e.what === 'bottle') {
            sfx('boil');
            sfx('pour', { vol: 0.6 });
          } else sfx('pick');
          break;
        case 'putBack':
          sfx(e.what === 'leech' ? 'clink' : 'pick');
          break;
        case 'attach':
          sfx(e.wild ? 'latch' : 'squelch');
          break;
        case 'fail':
          if (e.who !== this.me) break; // only the one who pressed hears why not
          sfx(e.fail === 'cold' ? 'refuse' : 'nope');
          if (e.target) this.sayAt(this.targetRect(e.target), FAIL[e.fail], 'info');
          break;
        case 'warm':
          sfx('pour');
          this.sayAt(this.ward.bedRect(e.bed), SAY.warmed, 'good');
          break;
        case 'leechDone':
          sfx('plip');
          break;
        case 'ready':
          sfx('ding');
          this.sayAt(this.ward.bedRect(e.bed), SAY.ready, 'good');
          break;
        case 'warning':
          sfx('tick');
          this.sayAt(this.ward.bedRect(e.bed), SAY.warning, 'cold');
          break;
        case 'faint':
          sfx('thud');
          sfx('gasp');
          this.sayAt(this.ward.bedRect(e.bed), `${e.cause === 'fright' ? SAY.faintFright : SAY.faintBlood}  ${e.fee} fr`, 'bad');
          break;
        case 'bandage':
          sfx('pat');
          sfx('coin');
          this.sayAt(this.ward.bedRect(e.bed), `${SAY[e.outcome]}  +${e.fee} fr`, e.outcome === 'green' ? 'good' : 'info');
          break;
        case 'lift':
          sfx('stretcher');
          break;
        case 'deliver':
          sfx('doorClose');
          this.sayAt(this.L.stations.door.box, SAY.delivered, 'info');
          break;
        case 'scoop':
          sfx('scoop');
          break;
        case 'salt':
          sfx('salt');
          this.sayAt(this.L.stations.bucket.box, SAY.salted(e.count), 'info');
          break;
        case 'recycled':
          sfx('delivery');
          this.sayAt(this.L.stations.jar.box, SAY.recycled(e.count), 'good');
          break;
        case 'escape':
          sfx('slither');
          this.sayAt(this.L.stations.jar.box, SAY.escape, 'bad');
          break;
        case 'latch':
          this.sayAt(this.ward.bedRect(e.bed), SAY.latch, 'bad');
          break;
        case 'drain':
          sfx('plip');
          this.say(`${SAY.drain}  ${e.fee} fr`, this.L.drain.x, this.L.drain.y - 10, 'bad');
          break;
        case 'catch':
          sfx('grab');
          break;
        case 'delivery':
          // a few drops as her boy tips them in
          sfx('delivery');
          this.time.delayedCall(110, () => sfx('delivery', { vol: 0.8 }));
          this.time.delayedCall(260, () => sfx('delivery', { vol: 0.6 }));
          this.sayAt(this.L.stations.jar.box, SAY.delivery(e.count), 'good');
          break;
        case 'slip':
          sfx('slipSplat');
          sfx('slip');
          sfx('thud');
          this.say(`${SAY.slip}  ${e.fee} fr${e.spilled ? SAY.spilled(e.spilled) : ''}`, ward.doctors[e.who].x, ward.doctors[e.who].y - 26, 'bad');
          break;
        case 'collide':
          sfx('thud');
          sfx('grunt');
          this.say(SAY.collide, e.x, e.y, 'bad');
          break;
        case 'jostle':
          sfx('grunt', { minGap: 0.5 });
          this.say(SAY.jostle, e.x, e.y, 'info');
          break;
        case 'bell':
          this.endShift();
          break;
      }
    }
  }

  private targetRect(t: Target): Rect {
    if (t.kind === 'bed') return this.ward.bedRect(t.bed);
    if (t.kind === 'station') return this.L.stations[t.id].box;
    const list = t.kind === 'used' ? this.ward.floor : this.ward.escapees;
    const f = list.find((x) => x.id === t.id);
    return f ? { x: f.x - 6, y: f.y - 6, w: 12, h: 12 } : { x: this.mine.x, y: this.mine.y - 24, w: 1, h: 1 };
  }

  private sayAt(r: Rect, str: string, tone: Tone) {
    this.say(str, r.x + r.w / 2, r.y - 2, tone);
  }

  // Floating words that rise in whole art pixels and vanish.
  private say(str: string, ax: number, ay: number, tone: Tone) {
    ay = Math.max(8, ay);
    // don't stack messages on top of each other
    this.recentSays = this.recentSays.filter((s) => this.t - s.t < 0.9);
    while (this.recentSays.some((s) => Math.abs(s.x - ax) < 40 && Math.abs(s.y - ay) < 9)) ay -= 9;
    this.recentSays.push({ x: ax, y: ay, t: this.t });
    const x = Math.min(this.L.world.w * P - 120, Math.max(120, Math.round(ax) * P));
    const msg = text(this, x, Math.round(ay) * P, str, { size: 18, color: TONE[tone], stroke: 'ink', strokeWidth: 5, align: 'center' })
      .setOrigin(0.5, 1).setDepth(DEPTH.say);
    this.tweens.add({
      targets: msg,
      y: msg.y - 8 * P,
      duration: 1400,
      ease: 'Stepped',
      easeParams: [8],
      onComplete: () => msg.destroy(),
    });
  }

  // ── Notes, pause, the bell ────────────────────────────────────────────────

  private showNote(note: Note, footer = WARD.noteFooter) {
    sfx('page');
    const c = this.add.container(0, 0).setDepth(DEPTH.note);
    c.add(this.add.tileSprite(0, 0, STAGE.w / P, STAGE.h / P, 'dither').setOrigin(0).setScale(P));
    const g = this.add.graphics();
    c.add(g);
    const w = 777;
    const x = Math.round((STAGE.w - w) / 2 / P) * P;
    // lay the words out from y = 0, measure, then centre the sheet
    const parts: (Phaser.GameObjects.Text | Phaser.GameObjects.Graphics)[] = [];
    const add = <T extends Phaser.GameObjects.Text | Phaser.GameObjects.Graphics>(o: T) => (parts.push(o), c.add(o), o);
    add(text(this, x + 36, 30, note.title, { font: 'display', size: 38 }));
    add(text(this, x + 38, 82, note.speaker, { size: 19, italic: true, color: 'red1' }));
    const body = add(text(this, x + 38, 118, note.body.join('\n\n'), { size: 23, wrap: w - 76, lineSpacing: 3 }));
    let hy = body.y + body.height + 18;
    if (note.hint) {
      const hint = text(this, x + 60, hy + 14, note.hint, { size: 20, wrap: w - 120, color: 'wood2', lineSpacing: 2 });
      const hg = this.add.graphics();
      panel(hg, x + 42, hy, w - 84, Math.ceil((hint.height + 28) / P) * P, 'paper0');
      add(hg);
      add(hint);
      hy += hint.height + 42;
    }
    if (note === STAGE_NOTES.basics) {
      add(text(this, x + w / 2, hy, CONTROLS, { size: 16, color: 'wood3' }).setOrigin(0.5, 0));
      hy += 34;
    }
    add(text(this, x + w / 2, hy + 18, footer, { font: 'display', size: 24, color: 'red2' }).setOrigin(0.5));
    const h = Math.ceil((hy + 48) / P) * P;
    const y = Math.round((STAGE.h - h) / 2 / P) * P;
    panel(g, x, y, w, h, 'paper1');
    for (const o of parts) o.y += y;
    this.noteView = c;
    this.noteShownAt = this.t;
  }

  private closeNote() {
    sfx('page');
    this.noteView?.destroy();
    this.noteView = null;
    if (this.paused) this.paused = false;
  }

  private togglePause() {
    if (this.ending) return;
    if (this.noteView) {
      if (this.paused) this.closeNote();
      return;
    }
    this.paused = true;
    // how far behind the sound is, as the browser reports it (Bluetooth adds a great deal)
    const ctx = audioDebug().ctx;
    const ms = (x: number | undefined) => (x == null ? '?' : `${Math.round(x * 1000)} ms`);
    const latency = ctx ? PAUSE.latency(ms(ctx.baseLatency), ms(ctx.outputLatency)) : PAUSE.latencyNone;
    this.showNote({
      speaker: PAUSE.speaker,
      title: PAUSE.title,
      body: [PAUSE.status(this.ward.day.title, this.ward.shift.clockText(), this.ward.shift.money), latency],
      hint: PAUSE.keys,
    }, PAUSE.footer);
  }

  private endShift() {
    this.ending = true;
    sfx('bell');
    this.say(SAY.bell, this.L.world.w / 2, 110, 'info');
    this.time.delayedCall(2200, () => {
      const o = this.online;
      if (!o) return this.scene.start('results', { ward: this.ward });
      o.toResults = true;
      if (o.report) this.toResults();
    });
  }

  // Online: the report has come; fill the mirror ward's books from it and go.
  private toResults() {
    const o = this.online!;
    const r = o.report!;
    const shift = this.ward.shift;
    shift.log.splice(0, shift.log.length, ...r.log);
    shift.money = r.money;
    shift.over = true;
    Object.assign(this.ward, { applied: r.applied, lost: r.lost, slips: r.slips, floorAtBell: r.floorAtBell });
    this.scene.start('results', { ward: this.ward, online: { net: o.net, report: r } });
  }

  // A stage note, online: a card in the corner for a while, and the game goes on.
  private showToast(note: Note) {
    sfx('page');
    this.toast?.view.destroy();
    const c = this.add.container(0, 0).setDepth(DEPTH.note);
    // bottom left: in the Grande Salle, the floor there is clear of every bed
    const w = 291;
    const x = 12;
    const g = this.add.graphics();
    const title = text(this, x + 16, 14, note.title, { font: 'display', size: 20, wrap: w - 32 });
    const who = text(this, x + 16, title.height + 18, note.speaker, { size: 14, italic: true, color: 'red1', wrap: w - 32 });
    const hint = text(this, x + 16, who.y + who.height + 8, note.hint ?? note.body.join(' '), { size: 15, wrap: w - 32, color: 'wood2', lineSpacing: 1 });
    const h = Math.ceil((hint.y + hint.height + 16) / P) * P;
    const y = STAGE.h - h - 12;
    panel(g, x, y, w, h, 'paper1');
    for (const o of [title, who, hint]) o.y += y;
    c.add([g, title, who, hint]);
    this.toast = { view: c, until: performance.now() / 1000 + 14 };
  }

  private toggleLeave() {
    if (this.leaveView) {
      this.leaveView.destroy();
      this.leaveView = null;
      return;
    }
    sfx('page');
    const c = this.add.container(0, 0).setDepth(DEPTH.note);
    const g = this.add.graphics();
    const w = 600;
    const x = (STAGE.w - w) / 2;
    const y = 250;
    panel(g, x, y, w, 186, 'paper1');
    c.add([
      g,
      text(this, x + w / 2, y + 26, ONLINE.leaveTitle, { font: 'display', size: 34 }).setOrigin(0.5, 0),
      text(this, x + w / 2, y + 80, ONLINE.leaveBody, { size: 18, wrap: w - 80, align: 'center', color: 'wood2' }).setOrigin(0.5, 0),
      text(this, x + w / 2, y + 140, ONLINE.leaveKeys, { font: 'display', size: 22, color: 'red2' }).setOrigin(0.5, 0),
    ]);
    this.leaveView = c;
  }

  private leave() {
    sfx('page');
    session.set(null);
    this.scene.start('title');
  }

  // ── Drawing ───────────────────────────────────────────────────────────────

  private render() {
    const ward = this.ward;
    const t = this.t;
    this.renderStations();
    this.renderBeds();
    this.renderFloor();
    this.renderDoctors();
    this.renderHighlight();
    this.renderQueue();

    const s = ward.supply;
    this.hud.clock.setText(ward.shift.clockText());
    this.hud.money.setText(`${ward.shift.money} fr`);
    this.hud.jar.setText(String(s.jar));
    this.hud.jarLabel.setText(String(s.jar));
    const secs = (n: number) => `${Math.max(0, Math.ceil(n))} s`;
    let banner = '';
    if (!s.deliveries) banner = WARD.noDeliveries;
    else if (s.jar < s.cap) banner = WARD.nextJar(secs(s.nextDelivery));
    this.hud.banner.setText(banner).setColor(s.deliveries ? '#ecdfc0' : '#c8483a');
    const salting = ward.salting.reduce((n, x) => n + x.count, 0);
    const back = ward.salting.length ? Math.min(...ward.salting.map((x) => x.left)) : 0;
    this.hud.salt.setText(salting ? WARD.salting(salting, secs(back)) : '');
    void t;
    this.sortCameras();
  }

  private renderStations() {
    const ward = this.ward;
    this.stations.stove.setTexture(`stove:${Math.floor(this.t * 2.5) % 2}`).setVisible(ward.stoveIn);
    this.stations.stand.setTexture(ward.stationTex('stand'));
  }

  private renderBeds() {
    const ward = this.ward;
    const g = this.gMeters;
    g.clear();
    ward.beds.forEach((b, i) => {
      const v = this.bedViews[i];
      const p = b.patient;
      const { x, y } = this.L.beds[i];
      const blink = b.leaving > 0 && Math.floor(b.leaving * 8) % 2 === 0;
      const shown = !!p && !blink;
      v.patient.setVisible(shown);
      v.bites.clear();
      if (!p) {
        v.leeches.forEach((l) => l.setVisible(false));
        v.icon.setVisible(false);
        v.warm.setVisible(false);
        if (v.labelKey) v.label.setText((v.labelKey = ''));
        return;
      }
      v.patient.setTexture(ensurePatientTexture(this, lookOf(p)));
      const shiver = p.active && (p.chilled || (p.type === 'nervous' && p.panic > 0.5));
      const shake = shiver && Math.floor(this.t * 14) % 2 ? 1 : 0;
      const px = x + 2 + shake;
      const py = y + 3;
      place(v.patient, px, py);

      v.leeches.forEach((img, slot) => {
        const l = p.leeches[slot];
        if (!l || !shown) return void img.setVisible(false);
        const frame = Math.min(SATED, Math.floor(l.fed * (SATED + 1)));
        const [sx, sy] = LEECH_SLOTS[slot];
        const wob = Math.floor(this.t * 3 + slot * 1.3) % 4 === 0 ? 1 : 0;
        img.setTexture(`leech:${frame}:${Math.floor(this.t * 3.2 + slot * 0.7) % 2}`).setVisible(true); // it throbs as it sucks
        place(img, px + sx - 6 + wob, py + sy - 6);
      });

      if (shown) {
        for (const slot of b.bites) {
          const [sx, sy] = LEECH_SLOTS[slot];
          const bx = px + sx;
          const by = py + sy;
          v.bites.fillStyle(hex('red2')).fillRect(bx * P, by * P, P, P);
          const drip = Math.floor(((this.t * 1.4 + slot * 0.37) % 1) * 3) + 1;
          v.bites.fillStyle(hex('red3')).fillRect(bx * P, (by + drip) * P, P, P);
        }
      }

      // the warmth of the hot-water bottle
      v.warm.setVisible(shown && p.cold && p.warmed && p.active);
      place(v.warm, px + 7, py + 8 - (Math.floor(this.t * 3) % 2));

      // status bubble
      const zone = p.zone();
      let icon: string | null = null;
      if (p.state === 'fainted') icon = 'icon:faint';
      else if (p.active && p.chilled) icon = 'icon:cold';
      else if (p.active && zone === 'blue') icon = Math.floor(this.t * 5) % 2 ? 'icon:warn' : null;
      else if (p.active && zone === 'green') icon = 'icon:ready';
      v.icon.setVisible(!!icon && shown);
      if (icon) {
        v.icon.setTexture(icon);
        place(v.icon, x + BED.w - 4, y - 6 - (icon === 'icon:ready' ? Math.floor(this.t * 2) % 2 : 0));
      }

      // name and type
      const tags = [p.type === 'soldier' ? '' : CONFIG.patient.types[p.type].label.toLowerCase(), p.cold ? ward.day.coldLabel : ''].filter(Boolean);
      const kind = tags.length ? `\n${tags.join(', ')}` : '';
      const key = `${p.profile.rank} ${p.profile.surname}${kind}`;
      if (key !== v.labelKey) v.label.setText((v.labelKey = key));
      v.label.setVisible(!blink);

      if (p.active) this.drawMeter(g, x, y + BED.h + 2, BED.w, p);
    });
  }

  // The blood bar: red (not yet), green (just right), blue (too much). Bands lit up to
  // the blood drawn; a dotted ghost shows where the leeches already on him will take him.
  // Every bar is on one scale (the hardiest man's faint at full width), so a frail man's bar is
  // visibly short: his red and green end early, and past his faint the bar is dark.
  private drawMeter(g: Phaser.GameObjects.Graphics, ax: number, ay: number, w: number, p: Patient) {
    const spec = p.spec;
    const full = spec.faintAt;
    const px = (v: number) => Math.round((Math.min(v, full) / METER_SCALE) * w);
    const end = px(full); // where he faints
    const h = 3;
    g.fillStyle(hex('ink')).fillRect((ax - 1) * P, (ay - 1) * P, (w + 2) * P, (h + 2) * P);
    const b = px(p.blood);
    const g0 = px(spec.green[0]);
    const g1 = px(spec.green[1]);
    const seg = (from: number, to: number, dim: PaletteKey, bright: PaletteKey) => {
      const lit = Math.max(from, Math.min(to, b));
      if (lit > from) g.fillStyle(hex(bright)).fillRect((ax + from) * P, ay * P, (lit - from) * P, h * P);
      if (to > lit) g.fillStyle(hex(dim)).fillRect((ax + lit) * P, ay * P, (to - lit) * P, h * P);
    };
    seg(0, g0, 'red1', 'red3');
    seg(g0, g1, 'green1', 'meterGreen1');
    seg(g1, end, 'navy1', 'meterBlue1');
    if (end < w) g.fillStyle(hex('red0')).fillRect((ax + end) * P, (ay - 1) * P, P, (h + 2) * P); // the faint line
    // the ghost of what the attached leeches will still draw
    const owed = p.leeches.reduce((s, l) => s + (l ? (1 - l.fed) * CONFIG.leech.feedSeconds * CONFIG.leech.extraction : 0), 0);
    const proj = px(p.blood + owed);
    g.fillStyle(hex('linen0'));
    for (let i = b; i < proj; i++) for (let j = 0; j < h; j++) if ((i + j) % 2 === 0) g.fillRect((ax + i) * P, (ay + j) * P, P, P);
    // the marker
    g.fillStyle(hex('linen0')).fillRect((ax + Math.min(b, end - 1)) * P, (ay - 1) * P, P, (h + 2) * P);

    // patience (untouched, waiting) or panic (nervous) under the bar
    let under: { share: number; c: PaletteKey } | null = null;
    if (p.state === 'waiting') under = { share: p.patience / CONFIG.patient.patience, c: p.patience < 12 ? 'red3' : 'paper2' };
    else if (p.type === 'nervous') under = { share: p.panic, c: 'red3' };
    if (under) {
      const uw = Math.max(0, Math.round(under.share * w));
      g.fillStyle(hex('ink')).fillRect((ax - 1) * P, (ay + h + 1) * P, (w + 2) * P, 3 * P);
      g.fillStyle(hex(under.c)).fillRect(ax * P, (ay + h + 2) * P, uw * P, P);
    }
  }

  private renderFloor() {
    const ward = this.ward;
    const seen = new Set<number>();
    for (const f of ward.floor) {
      seen.add(f.id);
      let img = this.floorSprites.get(f.id);
      if (!img) {
        img = sprite(this, `floor:used:${f.id % 4}:0`).setDepth(DEPTH.floorItem);
        this.floorSprites.set(f.id, img);
      }
      // gorged and sluggish, but still squirming: a slow wriggle, each in its own time
      img.setTexture(`floor:used:${f.id % 4}:${Math.floor(this.t * 1.7 + f.id * 0.61) % 2}`);
      place(img, f.x - 6, f.y - 6);
    }
    for (const [id, img] of this.floorSprites) if (!seen.has(id)) { img.destroy(); this.floorSprites.delete(id); }

    seen.clear();
    this.trailIn -= 1 / 60;
    const dropTrail = this.trailIn <= 0;
    if (dropTrail) this.trailIn = 0.35;
    for (const e of ward.escapees) {
      seen.add(e.id);
      let img = this.escapeeSprites.get(e.id);
      if (!img) {
        img = sprite(this, escapeKey(0, 0)).setDepth(DEPTH.floorItem + 1);
        this.escapeeSprites.set(e.id, img);
      }
      img.setTexture(escapeKey(escapeDir(e.angle), Math.floor(this.t * 4) % 2));
      place(img, e.x - 7, e.y - 7);
      if (dropTrail && !this.paused && !this.noteView) this.trail.push({ x: Math.round(e.x), y: Math.round(e.y), t: this.t });
    }
    for (const [id, img] of this.escapeeSprites) if (!seen.has(id)) { img.destroy(); this.escapeeSprites.delete(id); }

    // the damp trail behind an escapee, drying away
    this.trail = this.trail.filter((d) => this.t - d.t < 6);
    const gt = this.gTrail;
    gt.clear();
    for (const d of this.trail) {
      const age = this.t - d.t;
      gt.fillStyle(hex(age < 3 ? 'water1' : 'stone1')).fillRect(d.x * P, d.y * P, P, P);
    }
  }

  private renderDoctors() {
    const ward = this.ward;
    const k = 1 - Math.exp(-this.game.loop.delta / 1000 * 18);
    ward.doctors.forEach((d, i) => {
      const v = this.docViews[i];
      // a colleague, online, glides towards where the server last put him
      const s = v.shown;
      const remote = !!this.online && i !== this.me;
      if (!remote || Math.hypot(d.x - s.x, d.y - s.y) > 40) {
        s.x = d.x;
        s.y = d.y;
      } else {
        s.x += (d.x - s.x) * k;
        s.y += (d.y - s.y) * k;
      }
      const gone = d.x < 0; // his player has left
      const step = d.moving ? Math.floor(this.t / (d.running ? 0.09 : 0.15)) % 2 : 0;
      const depth = DEPTH.world + s.y;
      const down = d.dazed > 0;
      v.body.setVisible(!gone);
      if (down) {
        // flat on the flagstones, stars wheeling
        v.body.setTexture(`doc:${v.coat}:fallen`).setFlipX(d.flip).setDepth(depth);
        place(v.body, s.x - 13, s.y - 10);
        v.stars.setVisible(!gone).setTexture(`daze:${Math.floor(this.t * 5) % 2}`);
        place(v.stars, s.x - 7 + (d.flip ? -6 : 6), s.y - 16);
      } else {
        v.stars.setVisible(false);
        v.body.setTexture(`doc:${v.coat}:${d.facing}:${step}`).setFlipX(d.facing === 'side' && d.flip).setDepth(depth);
        place(v.body, s.x - 7, s.y - 24);
      }

      const hand = d.hand;
      const pumpBed = i === this.me ? this.pumpBed : d.pumped;
      const pumping = pumpBed != null && !gone;
      v.device.setVisible(pumping);
      if (pumping) {
        const b = this.L.beds[pumpBed!];
        const t = i === this.me ? this.pumpTime : this.t;
        v.device.setTexture(`cup:${Math.floor(t / 0.21) % 2}:${Math.floor(t * 2.5) % 5}`).setDepth(DEPTH.world + b.y + BED.h);
        place(v.device, b.x + 7, b.y + 12);
      }
      const key = down || gone ? null : carryTexture(hand);
      v.carry.setVisible(!!key && !pumping);
      v.count.setVisible(!down && !gone && hand?.kind === 'used' && hand.count > 1);
      let top = s.y - 25;
      if (key && !pumping) {
        v.carry.setTexture(key).setDepth(depth + 0.5);
        const fr = v.carry.frame;
        if (hand!.kind === 'stretcher') place(v.carry, s.x - 17, s.y - 16);
        else {
          place(v.carry, s.x - Math.floor(fr.width / 2), s.y - 24 - fr.height + 3);
          top -= fr.height;
        }
        if (hand?.kind === 'used') v.count.setText(`×${hand.count}`).setPosition((s.x + 5) * P, (s.y - 36) * P);
      }
      // his name over his head, out of the way of the prompt (which is ours alone)
      if (v.tag) v.tag.setVisible(!gone).setPosition(Math.round(s.x) * P, (Math.round(down ? s.y - 12 : top) - (i === this.me ? 9 : 1)) * P);
    });
    this.renderOrderlies();
  }

  private renderOrderlies() {
    const seen = new Set<number>();
    for (const o of this.ward.orderlies) {
      seen.add(o.id);
      let img = this.orderlySprites.get(o.id);
      if (!img) {
        img = sprite(this, `orderly:0:${o.load}`);
        this.orderlySprites.set(o.id, img);
      }
      const step = o.moving ? Math.floor(this.t / 0.2) % 2 : 0;
      img.setTexture(`orderly:${step}:${o.load}`).setFlipX(o.flip).setDepth(DEPTH.world + o.y);
      place(img, o.x - (o.flip ? 10 : 8), o.y - 25);
    }
    for (const [id, img] of this.orderlySprites) if (!seen.has(id)) { img.destroy(); this.orderlySprites.delete(id); }
  }

  private renderHighlight() {
    const ward = this.ward;
    const g = this.gHighlight;
    g.clear();
    const d = this.mine;
    const tg = this.ending || this.leaveView ? null : ward.target(this.me);
    let label = '';
    if (tg?.check.ok) {
      const r = this.targetRect(tg.target);
      const c = hex('brass2');
      const L = 4;
      const x0 = (r.x - 2) * P, y0 = (r.y - 2) * P, x1 = (r.x + r.w + 1) * P, y1 = (r.y + r.h + 1) * P;
      g.fillStyle(c);
      for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]] as const) {
        g.fillRect(sx > 0 ? cx : cx - (L - 1) * P, cy, L * P, P);
        g.fillRect(cx, sy > 0 ? cy : cy - (L - 1) * P, P, L * P);
      }
      label = tg.check.verb === 'pump' ? (this.pumpBed != null ? WARD.pumping : WARD.hold(VERB.pump)) : WARD.press(VERB[tg.check.verb]);
    }
    const lift = d.hand && d.hand.kind !== 'stretcher' && this.pumpBed == null ? this.docViews[this.me].carry.frame.height : 0;
    this.prompt.setText(label).setPosition(Math.round(d.x) * P, (Math.round(d.y) - 25 - lift) * P);
  }

  private renderQueue() {
    const q = this.ward.queue;
    this.hud.queue.setVisible(q.length > 0);
    this.queueViews.forEach((v, i) => {
      const e = q[i];
      v.head.setVisible(!!e);
      if (!e) return void v.name.setText('');
      const pt = e.profile.portrait as unknown as Wardrobe;
      const look: PatientLook = {
        ...wardrobe(pt),
        skin: pt.skin,
        hair: e.type === 'drummer' ? 'hairBrown' : pt.hair,
        moustache: pt.moustache && e.type !== 'drummer',
        build: e.type === 'anemic' ? 'thin' : e.type === 'drummer' ? 'small' : 'normal',
        pallor: e.type === 'anemic' ? 2 : 0,
        eyes: e.type === 'nervous' ? 'wide' : 'open',
        sweat: e.left < 12,
        cold: e.cold,
      };
      v.head.setTexture(ensurePatientTexture(this, look)).setCrop(0, 0, 22, 14);
      // how long he'll wait at the door
      const ay = 38 + i * 26 + 16;
      const share = Math.max(0, e.left / CONFIG.patient.queuePatience);
      const g = this.gMeters;
      g.fillStyle(hex('ink')).fillRect(5 * P, (ay - 1) * P, 24 * P, 3 * P);
      g.fillStyle(hex(e.left < 12 ? 'red3' : 'paper2')).fillRect(6 * P, ay * P, Math.round(share * 22) * P, P);
      const kind = e.type === 'soldier' ? '' : `, ${CONFIG.patient.types[e.type].label.toLowerCase()}`;
      const left = e.left < 12 ? `  ${WARD.leaving}` : '';
      v.name.setText(`${e.profile.surname}${kind}${left}`).setColor(e.left < 12 ? '#c8483a' : '#ddd6c4');
    });
  }
}

function carryTexture(hand: Hand): string | null {
  if (!hand) return null;
  switch (hand.kind) {
    case 'leech': return handKey(Math.min(3, hand.count), Math.floor(performance.now() / 260) % 2);
    case 'used': return 'item:used';
    case 'bandage': return 'item:bandage';
    case 'bottle': return 'item:bottle';
    case 'bdello': return 'item:bdello';
    case 'stretcher': return 'item:stretcher';
  }
}
