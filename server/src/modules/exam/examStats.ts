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
