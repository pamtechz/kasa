import type {SiteSettings} from './site';
import type {Programme,Announcement} from './content';

let memorySite: SiteSettings | null = null;
let sitePromise: Promise<SiteSettings | null> | null = null;

export function getCachedSite(): SiteSettings | null {
  return memorySite;
}

export function setCachedSite(site: SiteSettings): void {
  memorySite = site;
}

export async function fetchSiteCached(signal?: AbortSignal): Promise<SiteSettings | null> {
  if (memorySite) return memorySite;
  if (sitePromise) return sitePromise;

  sitePromise = fetch('/api/public/site', {signal})
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      if (data?.site) {
        memorySite = data.site as SiteSettings;
        return memorySite;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      sitePromise = null;
    });

  return sitePromise;
}

const contentCache: Record<string, {items: (Programme | Announcement)[]; fetchedAt: number}> = {};
const CACHE_TTL_MS = 60_000;

export async function fetchContentCached(kind: 'programmes' | 'announcements'): Promise<(Programme | Announcement)[]> {
  const hit = contentCache[kind];
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
    return hit.items;
  }
  const r = await fetch(`/api/public/content?kind=${kind}`);
  const d = await r.json();
  if (!r.ok) throw Error(d.error || 'Unable to load content');
  const items = (Array.isArray(d.items) ? d.items : []) as (Programme | Announcement)[];
  contentCache[kind] = {items, fetchedAt: Date.now()};
  return items;
}
