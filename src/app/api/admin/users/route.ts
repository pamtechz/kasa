import {db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {operator} from '@/lib/security';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    await operator(req, ['super_admin', 'admin', 'reviewer']);
    const url = new URL(req.url);
    const roleFilter = url.searchParams.get('role');
    const search = url.searchParams.get('search')?.toLowerCase().trim() || '';

    let snap;
    if (roleFilter && ['student', 'agent', 'admin', 'reviewer', 'super_admin'].includes(roleFilter)) {
      snap = await db.collection('profiles').where('role', '==', roleFilter).limit(300).get();
    } else {
      snap = await db.collection('profiles').limit(400).get();
    }

    let users = snap.docs.map(d => ({uid: d.id, ...d.data()}));

    if (search) {
      users = users.filter((u: any) =>
        String(u.displayName || '').toLowerCase().includes(search) ||
        String(u.email || '').toLowerCase().includes(search) ||
        String(u.phone || '').toLowerCase().includes(search) ||
        String(u.district || '').toLowerCase().includes(search) ||
        String(u.agentCode || '').toLowerCase().includes(search)
      );
    }

    return json({users});
  } catch (e) {
    return fail(e);
  }
}
