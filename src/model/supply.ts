// Madame Ricard's jar: the hungry-leech supply and her boy's deliveries. How often he
// comes (and with how many) depends on the year; in 1832 he doesn't come at all, and
// salted leeches are all you get back.

import { CONFIG } from '../config';

export type SupplyEvent = { kind: 'delivery'; count: number };

export class Supply {
  jar: number;
  readonly schedule: { every: number; size: number } | null;
  readonly cap: number; // deliveries never fill the jar past this
  nextDelivery: number;

  constructor(start: number, schedule: { every: number; size: number } | null, cap: number = CONFIG.supply.cap) {
    this.jar = start;
    this.schedule = schedule;
    this.cap = cap;
    this.nextDelivery = schedule?.every ?? Infinity;
  }

  get deliveries(): boolean {
    return this.schedule != null;
  }

  take(): boolean {
    if (this.jar <= 0) return false;
    this.jar--;
    return true;
  }

  give(n = 1) {
    this.jar += n;
  }

  tick(dt: number): SupplyEvent[] {
    const sch = this.schedule;
    if (!sch) return [];
    this.nextDelivery -= dt;
    if (this.nextDelivery > 0) return [];
    this.nextDelivery += sch.every;
    const count = Math.max(0, Math.min(sch.size, this.cap - this.jar));
    if (!count) return [];
    this.jar += count;
    return [{ kind: 'delivery', count }];
  }
}
