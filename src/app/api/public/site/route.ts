import {NextResponse} from 'next/server';
import {isFirebaseConfigured} from '@/lib/readiness';
import {defaultSite,sanitizeSite,type SiteSettings} from '@/lib/site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let memoryCache: {site: SiteSettings; expiresAt: number} | null = null;
const CACHE_TTL_MS = 20_000;

export async function GET() {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return NextResponse.json({site: memoryCache.site}, {
      headers: {'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30'}
    });
  }

  let site = defaultSite;
  if (isFirebaseConfigured()) {
    try {
      const {db} = await import('@/lib/firebase-admin');
      const snapshot = await db.collection('settings').doc('site').get();
      if (snapshot.exists) site = sanitizeSite(snapshot.data()?.content);
    } catch {
      /* Public website remains readable during maintenance. */
    }
  }

  memoryCache = {site, expiresAt: now + CACHE_TTL_MS};
  return NextResponse.json({site}, {
    headers: {'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30'}
  });
}
