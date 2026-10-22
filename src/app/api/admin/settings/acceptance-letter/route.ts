import {NextRequest} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {fail, json} from '@/lib/errors';
import {requirePermission} from '@/lib/security';
import {
  acceptanceLetterConfigSchema,
  defaultAcceptanceLetterConfig
} from '@/lib/acceptance-letter-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let cachedConfig: {config: any; updatedAt: string | null; isDefault: boolean; timestamp: number} | null = null;
const CONFIG_CACHE_TTL = 45_000;

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req,'acceptance.manage');
    if (cachedConfig && Date.now() - cachedConfig.timestamp < CONFIG_CACHE_TTL) {
      return json({
        config: cachedConfig.config,
        updatedAt: cachedConfig.updatedAt,
        isDefault: cachedConfig.isDefault
      });
    }
    const doc = await db.collection('settings').doc('acceptanceLetter').get();
    if (!doc.exists) {
      return json({config: defaultAcceptanceLetterConfig, isDefault: true});
    }
    const data = doc.data() || {};
    const parsed = acceptanceLetterConfigSchema.safeParse(data);
    const resultConfig = parsed.success ? parsed.data : defaultAcceptanceLetterConfig;
    cachedConfig = {
      config: resultConfig,
      updatedAt: data.updatedAt || null,
      isDefault: false,
      timestamp: Date.now()
    };
    return json({
      config: resultConfig,
      updatedAt: data.updatedAt || null,
      isDefault: false
    });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requirePermission(req,'acceptance.manage');
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
    cachedConfig = {
      config: parsed.data,
      updatedAt: now,
      isDefault: false,
      timestamp: Date.now()
    };
    return json({ok: true, config: parsed.data, updatedAt: now});
  } catch (e) {
    return fail(e);
  }
}
