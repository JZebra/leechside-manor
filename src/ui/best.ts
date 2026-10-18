// The best shift so far, kept in localStorage when the browser allows it.

const KEY = 'lc-best';

export interface Best {
  money: number;
  verdict: string;
}

export function loadBest(): Best | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Best) : null;
  } catch {
    return null;
  }
}

// Returns true when this shift beats the record.
export function saveBest(b: Best): boolean {
  const old = loadBest();
  if (old && old.money >= b.money) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* storage unavailable */
  }
  return true;
}
