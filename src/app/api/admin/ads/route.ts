import {db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {requirePermission,operator, newId, sameOrigin, safeText} from '@/lib/security';

export const runtime = 'nodejs';

export type AdCampaign = {
  id: string;
  headline: string;
  description: string;
  imageUrl: string;
  targetUrl: string;
  placement: 'all' | 'homepage_hero' | 'programmes' | 'sidebar' | 'student_portal';
  ctaText: string;
  active: boolean;
  impressions: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
};

export async function GET(req: Request) {
  try {
    await requirePermission(req,'content.manage');
    const snap = await db.collection('adCampaigns').limit(100).get();
    const ads = snap.docs.map(d => ({id: d.id, ...d.data()}));
    return json({ads});
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requirePermission(req,'content.manage');
    const body = await req.json();

    const headline = safeText(body.headline, 120);
    const description = safeText(body.description, 300);
    const imageUrl = safeText(body.imageUrl, 500);
    const targetUrl = safeText(body.targetUrl, 500);
    const placement = ['all', 'homepage_hero', 'programmes', 'sidebar', 'student_portal'].includes(body.placement) ? body.placement : 'all';
    const ctaText = safeText(body.ctaText, 50) || 'Learn More';
    const active = body.active !== false;

    if (!headline) throw new HttpError(400, 'Ad headline is required.');

    const id = newId();
    const now = new Date().toISOString();
    const docData: AdCampaign = {
      id,
      headline,
      description,
      imageUrl,
      targetUrl: targetUrl || '/',
      placement,
      ctaText,
      active,
      impressions: 0,
      clicks: 0,
      createdAt: now,
      updatedAt: now
    };

    await db.collection('adCampaigns').doc(id).set(docData);
    return json({ok: true, id, ad: docData}, 201);
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request) {
  try {
    sameOrigin(req);
    await requirePermission(req,'content.manage');
    const body = await req.json();
    const id = safeText(body.id, 64);

    if (!id) throw new HttpError(400, 'Ad ID is required.');
    const ref = db.collection('adCampaigns').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Ad campaign not found.');

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString()
    };

    if (typeof body.headline === 'string') updates.headline = safeText(body.headline, 120);
    if (typeof body.description === 'string') updates.description = safeText(body.description, 300);
    if (typeof body.imageUrl === 'string') updates.imageUrl = safeText(body.imageUrl, 500);
    if (typeof body.targetUrl === 'string') updates.targetUrl = safeText(body.targetUrl, 500);
    if (typeof body.placement === 'string') updates.placement = body.placement;
    if (typeof body.ctaText === 'string') updates.ctaText = safeText(body.ctaText, 50);
    if (typeof body.active === 'boolean') updates.active = body.active;

    await ref.update(updates);
    return json({ok: true, id, ...updates});
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    await requirePermission(req,'content.manage');
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) throw new HttpError(400, 'Ad ID is required.');
    const ref = db.collection('adCampaigns').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Ad campaign not found.');

    await ref.delete();
    return json({ok: true, deletedId: id});
  } catch (e) {
    return fail(e);
  }
}
