import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {contentCollection,visibleAnnouncement,type Announcement,type Programme} from '@/lib/content';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const contentCache: Record<string, {items: (Programme | Announcement)[]; expiresAt: number}> = {};
const CACHE_TTL_MS = 20_000;

export async function GET(req: Request) {
  try {
    const kind = new URL(req.url).searchParams.get('kind') || '';
    const collection = contentCollection(kind);
    if (!collection) return json({items: []});

    const now = Date.now();
    const hit = contentCache[collection];
    if (hit && hit.expiresAt > now) {
      return json({items: hit.items});
    }

    const result = await db.collection(collection).where('published', '==', true).limit(150).get();
    const items: (Programme | Announcement)[] = result.docs
      .map(d => ({...d.data(), id: d.id}) as Programme | Announcement)
      .filter(d => collection !== 'announcements' || visibleAnnouncement(d as Announcement));

    items.sort((a, b) => Number((b as {pinned?: boolean}).pinned || 0) - Number((a as {pinned?: boolean}).pinned || 0) || String(a.title).localeCompare(String(b.title)));

    contentCache[collection] = {items, expiresAt: now + CACHE_TTL_MS};
    return json({items});
  } catch (e) {
    return fail(e);
  }
}
