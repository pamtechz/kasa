import {NextRequest} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {fail, json} from '@/lib/errors';
import {operator} from '@/lib/security';
import {
  acceptanceLetterConfigSchema,
  defaultAcceptanceLetterConfig
} from '@/lib/acceptance-letter-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await operator(req, ['super_admin', 'admin']);
    const doc = await db.collection('settings').doc('acceptanceLetter').get();
    if (!doc.exists) {
      return json({config: defaultAcceptanceLetterConfig, isDefault: true});
    }
    const data = doc.data() || {};
    const parsed = acceptanceLetterConfigSchema.safeParse(data);
    return json({
      config: parsed.success ? parsed.data : defaultAcceptanceLetterConfig,
      updatedAt: data.updatedAt || null,
      isDefault: false
    });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await operator(req, ['super_admin', 'admin']);
    const body = await req.json();
    const parsed = acceptanceLetterConfigSchema.safeParse(body?.config || body);
    if (!parsed.success) {
      return fail(parsed.error);
    }
    const now = new Date().toISOString();
    await db.collection('settings').doc('acceptanceLetter').set({
      ...parsed.data,
      updatedAt: now,
      updatedBy: user.uid
    });
    return json({ok: true, config: parsed.data, updatedAt: now});
  } catch (e) {
    return fail(e);
  }
}
