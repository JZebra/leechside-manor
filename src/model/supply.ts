// Madame Ricard's jar: the hungry-leech supply, deliveries, and shortages.

import { CONFIG } from '../config';

export type ShortagePhase = 'none' | 'warning' | 'active' | 'over';
export type SupplyEvent =
  | { kind: 'delivery'; count: number }
  | { kind: 'shortageWarning' }
  | { kind: 'shortageStart' }
  | { kind: 'shortageEnd' };

export class Supply {
  jar: number = CONFIG.supply.start;
  phase: ShortagePhase = 'none';
  phaseLeft = 0; // seconds left in the current shortage phase
  nextDelivery: number = CONFIG.supply.deliveryEvery;

  get delivering(): boolean {
    return this.phase !== 'active';
  }

  take(): boolean {
    if (this.jar <= 0) return false;
    this.jar--;
    return true;
  }

  give(n = 1) {
    this.jar += n;
  }

  beginShortage(): SupplyEvent[] {
    if (this.phase !== 'none') return [];
    this.phase = 'warning';
    this.phaseLeft = CONFIG.supply.shortage.warnSeconds;
    return [{ kind: 'shortageWarning' }];
  }

  tick(dt: number): SupplyEvent[] {
    const out: SupplyEvent[] = [];
    if (this.phase === 'warning' || this.phase === 'active') {
      this.phaseLeft -= dt;
      if (this.phaseLeft <= 0) {
        if (this.phase === 'warning') {
          this.phase = 'active';
          this.phaseLeft = CONFIG.supply.shortage.seconds;
          out.push({ kind: 'shortageStart' });
        } else {
          this.phase = 'over';
          this.nextDelivery = 0; // the boy arrives with the jar at once
          out.push({ kind: 'shortageEnd' });
        }
      }
    }
    if (this.delivering) {
      this.nextDelivery -= dt;
      if (this.nextDelivery <= 0) {
        this.nextDelivery += CONFIG.supply.deliveryEvery;
        const count = Math.max(0, Math.min(CONFIG.supply.deliverySize, CONFIG.supply.cap - this.jar));
        if (count > 0) {
          this.jar += count;
          out.push({ kind: 'delivery', count });
        }
      }
    }
    return out;
  }
}
