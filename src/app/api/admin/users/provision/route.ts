import {adminAuth, db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {operator, newId, sameOrigin, safeText, audit} from '@/lib/security';
import type {Profile} from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const actor = await operator(req, ['super_admin', 'admin']);
    const body = await req.json();

    const email = safeText(body.email, 240).toLowerCase().trim();
    const displayName = safeText(body.displayName || body.name, 120).trim();
    const role = ['student', 'agent', 'admin', 'reviewer'].includes(body.role) ? body.role : 'student';
    if (actor.role !== 'super_admin' && ['admin','reviewer'].includes(role)) {
      throw new HttpError(403, 'Only a super administrator can assign staff roles.');
    }
    const district = safeText(body.district, 100).trim();
    const phone = safeText(body.phone, 40).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'A valid email address is required.');
    }
    if (!displayName) {
      throw new HttpError(400, 'Full name is required.');
    }

    // Role assignment is only allowed to an existing, genuinely verified
    // Firebase identity. New users must sign up and verify their own email.
    const authUser = await adminAuth.getUserByEmail(email).catch(() => null);
    if (!authUser) throw new HttpError(409, 'Ask the user to register and verify their email before provisioning.');
    if (!authUser.emailVerified) throw new HttpError(403, 'The user must verify their email before role assignment.');
    const existing = await db.collection('profiles').doc(authUser.uid).get();
    const previousRole = String(existing.data()?.role || '');
    if (previousRole === 'super_admin') throw new HttpError(403, 'Super administrator accounts cannot be provisioned here.');
    if (actor.role !== 'super_admin' && ['admin','reviewer'].includes(previousRole)) {
      throw new HttpError(403, 'Only a super administrator can modify staff accounts.');
    }

    const uid = authUser.uid;
    const now = new Date().toISOString();
    const agentCode = role === 'agent' ? `KASA-AGT-${uid.slice(0, 6).toUpperCase()}` : undefined;
    const studentCode = role === 'student' ? `KASA-STU-${uid.slice(0, 6).toUpperCase()}` : undefined;

    const profileData: Partial<Profile> & Record<string, unknown> = {
      uid,
      email,
      displayName,
      role: role as any,
      active: true,
      phone: phone || undefined,
      district: district || undefined,
      updatedAt: now
    };

    if (agentCode) profileData.agentCode = agentCode;
    if (studentCode) profileData.agentCode = studentCode;

    await db.collection('profiles').doc(uid).set(profileData, {merge: true});

    // Create notification in notificationOutbox for record keeping
    const noticeId = newId();
    await db.collection('notificationOutbox').doc(noticeId).set({
      title: `Account Provisioned (${role.toUpperCase()} PORTAL)`,
      message: `Existing verified user ${displayName} (${email}) was assigned the ${role} role.`,
      reference: agentCode || studentCode || 'ADMIN-PROVISION',
      recipient: 'admin',
      recipientUid: null,
      priority: 'important',
      event: 'user_provisioned',
      read: false,
      readBy: [],
      createdAt: now,
      updatedAt: now,
      createdBy: actor.displayName || actor.email,
      createdUid: actor.uid
    });

    await audit(actor.uid, 'user.provisioned', uid, {email, role, district, ...(agentCode ? {agentCode} : {})});

    return json({
      ok: true,
      uid,
      email,
      displayName,
      role,
      tempPassword: null,
      agentCode: agentCode || studentCode || null,
      message: `Existing verified account updated for ${displayName} (${role.toUpperCase()}).`
    }, 201);
  } catch (e) {
    return fail(e);
  }
}
