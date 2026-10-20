import {NextRequest, NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {FieldValue} from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const placement = url.searchParams.get('placement') || 'all';

    const snap = await db.collection('adCampaigns').where('active', '==', true).limit(20).get();
    let ads = snap.docs.map(d => ({id: d.id, ...d.data()}));

    if (placement !== 'all') {
      ads = ads.filter((a: any) => a.placement === 'all' || a.placement === placement);
    }

    if (ads.length === 0) {
      return NextResponse.json({ads: []});
    }

    // Pick 1 random active ad and increment its impressions
    const selectedAd: any = ads[Math.floor(Math.random() * ads.length)];
    try {
      await db.collection('adCampaigns').doc(selectedAd.id).update({
        impressions: FieldValue.increment(1)
      });
    } catch {}

    return NextResponse.json({ad: selectedAd, ads});
  } catch (e) {
    return NextResponse.json({error: 'Unable to load ads.'}, {status: 500});
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || '').trim();

    if (id) {
      await db.collection('adCampaigns').doc(id).update({
        clicks: FieldValue.increment(1)
      });
    }

    return NextResponse.json({ok: true});
  } catch (e) {
    return NextResponse.json({error: 'Ad click recording failed.'}, {status: 500});
  }
}
