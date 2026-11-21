// In-memory limiter for failed login attempts, keyed by client IP.
// A single-process admin panel does not need a shared store.
function createLoginLimiter({ maxFailures, windowMs, maxTracked = 10000 }) {
  const failures = new Map(); // key -> { count, firstAt }

  function current(key) {
    const entry = failures.get(key);
    if (entry && Date.now() - entry.firstAt >= windowMs) {
      failures.delete(key);
      return undefined;
    }
    return entry;
  }

  function pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of failures) {
      if (now - entry.firstAt >= windowMs) failures.delete(key);
    }
  }

  return {
    isBlocked(key) {
      const entry = current(key);
      return Boolean(entry) && entry.count >= maxFailures;
    },
    retryAfterSeconds(key) {
      const entry = current(key);
      if (!entry) return 0;
      return Math.max(1, Math.ceil((entry.firstAt + windowMs - Date.now()) / 1000));
    },
    recordFailure(key) {
      const entry = current(key);
      if (entry) {
        entry.count += 1;
        return;
      }
      if (failures.size >= maxTracked) pruneExpired();
      failures.set(key, { count: 1, firstAt: Date.now() });
    },
    reset(key) {
      failures.delete(key);
    },
  };
}

module.exports = { createLoginLimiter };
