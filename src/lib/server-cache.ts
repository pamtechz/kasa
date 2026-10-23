export const submissionsCache = new Map<string, {items: Record<string,unknown>[]; timestamp: number}>();
export const SUBMISSIONS_CACHE_TTL = 15_000;

export function invalidateSubmissionsCache() {
  submissionsCache.clear();
}

export const generalServerCache = new Map<string, {data: any; timestamp: number}>();
export const GENERAL_CACHE_TTL = 20_000;

export function getGeneralCache<T=any>(key: string): T | null {
  const cached = generalServerCache.get(key);
  if (cached && Date.now() - cached.timestamp < GENERAL_CACHE_TTL) {
    return cached.data as T;
  }
  return null;
}

export function setGeneralCache(key: string, data: any) {
  generalServerCache.set(key, {data, timestamp: Date.now()});
}

export function invalidateGeneralCache(prefix?: string) {
  if (!prefix) {
    generalServerCache.clear();
    return;
  }
  for (const key of generalServerCache.keys()) {
    if (key.startsWith(prefix)) {
      generalServerCache.delete(key);
    }
  }
}
