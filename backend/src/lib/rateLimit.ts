type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimiter = {
  /** Records an attempt and reports whether the caller is still within budget. */
  tryConsume: (key: string) => boolean;
  reset: (key: string) => void;
};

/**
 * Minimal in-memory fixed-window limiter, enough to stop a single process from
 * being used to spam password reset emails. A shared store would be needed if
 * the backend is ever scaled to multiple instances.
 */
export const createRateLimiter = ({
  maxAttempts,
  windowMs
}: {
  maxAttempts: number;
  windowMs: number;
}): RateLimiter => {
  const entries = new Map<string, RateLimitEntry>();

  const pruneExpiredEntries = (now: number) => {
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) {
        entries.delete(key);
      }
    }
  };

  return {
    tryConsume: (key: string) => {
      const now = Date.now();
      pruneExpiredEntries(now);

      const entry = entries.get(key);

      if (!entry) {
        entries.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      if (entry.count >= maxAttempts) {
        return false;
      }

      entry.count += 1;
      return true;
    },
    reset: (key: string) => {
      entries.delete(key);
    }
  };
};
