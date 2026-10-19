'use client';

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

const cache = new Map<string, CacheEntry<any>>();
const inFlight = new Map<string, Promise<any>>();

// Default TTL: 45 seconds for admin reads, revalidates in background
const DEFAULT_TTL = 45_000;

export function getAdminCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  // If entry exists, return it (even if stale, for SWR pattern)
  return entry.data as T;
}

export function isCacheFresh(key: string): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp < entry.ttl;
}

export function setAdminCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
}

export function invalidateAdminCache(pattern?: string | RegExp): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of Array.from(cache.keys())) {
    if (typeof pattern === 'string') {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    } else if (pattern.test(key)) {
      cache.delete(key);
    }
  }
}

/**
 * High-performance fetch with Stale-While-Revalidate support.
 * Returns cached data immediately if available, while triggering a background refresh if stale.
 */
export async function fetchWithSwr<T>(
  path: string,
  fetcher: () => Promise<T>,
  onBackgroundUpdate?: (freshData: T) => void,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  const cached = getAdminCache<T>(path);
  const fresh = isCacheFresh(path);

  // If we have fresh cached data, return it immediately without fetching
  if (cached && fresh) {
    return cached;
  }

  // Deduplicate in-flight promises for the same path
  let promise = inFlight.get(path);
  if (!promise) {
    promise = (async () => {
      try {
        const freshData = await fetcher();
        setAdminCache(path, freshData, ttl);
        if (cached && onBackgroundUpdate) {
          // If caller was already displaying stale data, notify them with fresh data
          onBackgroundUpdate(freshData);
        }
        return freshData;
      } finally {
        inFlight.delete(path);
      }
    })();
    inFlight.set(path, promise);
  }

  // If we have stale data, return it immediately while the in-flight request runs in background
  if (cached) {
    // Fire and forget in-flight refresh
    void promise.catch(() => {});
    return cached;
  }

  return promise;
}
