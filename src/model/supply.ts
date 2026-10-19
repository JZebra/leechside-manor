// Madame Ricard's jar: the hungry-leech supply and her boy's deliveries.
// On the day of the shortage nothing comes: salted leeches are all you get back.

import { CONFIG } from '../config';

export type SupplyEvent = { kind: 'delivery'; count: number };

export class Supply {
  jar: number;
  readonly deliveries: boolean;
  nextDelivery: number = CONFIG.supply.deliveryEvery;

  constructor(start: number, deliveries: boolean) {
    this.jar = start;
    this.deliveries = deliveries;
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
    if (!this.deliveries) return [];
    this.nextDelivery -= dt;
    if (this.nextDelivery > 0) return [];
    this.nextDelivery += CONFIG.supply.deliveryEvery;
    const count = Math.max(0, Math.min(CONFIG.supply.deliverySize, CONFIG.supply.cap - this.jar));
    if (!count) return [];
    this.jar += count;
    return [{ kind: 'delivery', count }];
  }
}
