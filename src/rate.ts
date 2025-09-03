type Key = string;

interface Bucket {
  capacity: number;
  tokens: number;
  refillRatePerSec: number; // tokens per second
  lastRefill: number; // ms epoch
}

const buckets = new Map<Key, Bucket>();

function nowMs(): number {
  return Date.now();
}

export function allow(key: string, capacity: number, perSeconds: number): boolean {
  const k = String(key || "").trim();
  if (!k) return true;
  const refillRate = capacity / Math.max(1, perSeconds);
  let b = buckets.get(k);
  const now = nowMs();
  if (!b) {
    b = { capacity, tokens: capacity, refillRatePerSec: refillRate, lastRefill: now };
    buckets.set(k, b);
  }
  // Refill tokens
  const elapsed = Math.max(0, (now - b.lastRefill) / 1000);
  b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.refillRatePerSec);
  b.lastRefill = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return true;
  }
  return false;
}


