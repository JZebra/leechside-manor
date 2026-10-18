// URL flags for testing: ?seed=abc fixes the shift · ?fast=4 runs the clock 4× ·
// ?stage=machine starts the shift at that stage (skipping earlier notes) · ?notes=0 hides notes.

import type { StageId } from './config';

function params(): URLSearchParams {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

const q = params();
export const FLAGS = {
  seed: q.get('seed'),
  fast: Math.max(0.1, Number(q.get('fast')) || 1),
  stage: (q.get('stage') as StageId | null) ?? null,
  notes: q.get('notes') !== '0',
  debug: q.get('debug') === '1',
};
