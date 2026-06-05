// Pure statistics helpers for the exam reports (§12), kept dependency-free so
// they can be unit-tested in isolation.

// Pearson correlation between a question's per-attempt scores and the attempt
// totals — a simple item discrimination index (how well a question separates
// strong from weak test-takers). Returns null when undefined (n<2 or no spread).
export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2 || ys.length !== n) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return Math.round((num / Math.sqrt(dx * dy)) * 1000) / 1000;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
    : Math.round(sorted[mid] * 100) / 100;
}

// Item facility (difficulty index): mean fraction of the available points
// earned on a question across attempts. Returns null when not computable.
export function facility(scores: number[], maxPoints: number): number | null {
  if (scores.length === 0 || maxPoints <= 0) return null;
  const sum = scores.reduce((s, v) => s + v, 0);
  return Math.round((sum / (scores.length * maxPoints)) * 1000) / 1000;
}

// Population standard deviation. Returns null when undefined (n<2).
export function stdev(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n;
  return Math.round(Math.sqrt(variance) * 1000) / 1000;
}

// Classic item discrimination index (D): the difference in success rate on an
// item between the strongest and weakest test-takers. Attempts are ranked by
// `ranks` (their overall total score) and split into the top/bottom 27% groups;
// the result is mean(top item fraction) − mean(bottom item fraction), in [-1, 1].
//   • values[i] = fraction of the item's points earned by attempt i (0..1)
//   • ranks[i]  = attempt i's overall total score (the ranking key)
// Returns null when undefined (n<4 — groups too small to be meaningful).
export function discrimination27(values: number[], ranks: number[]): number | null {
  const n = values.length;
  if (n < 4 || ranks.length !== n) return null;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => ranks[b] - ranks[a]);
  const groupSize = Math.max(1, Math.floor(n * 0.27));
  const top = order.slice(0, groupSize);
  const bottom = order.slice(n - groupSize);
  const mean = (group: number[]) => group.reduce((s, i) => s + values[i], 0) / group.length;
  return Math.round((mean(top) - mean(bottom)) * 1000) / 1000;
}
