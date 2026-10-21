import {adminAuth, db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {operator, newId, sameOrigin, safeText, audit} from '@/lib/security';
import type {Profile} from '@/lib/types';

export const runtime = 'nodejs';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Kasa#${rand}`;
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const actor = await operator(req, ['super_admin', 'admin']);
    const body = await req.json();

    const email = safeText(body.email, 240).toLowerCase().trim();
    const displayName = safeText(body.displayName || body.name, 120).trim();
    const role = ['student', 'agent', 'admin', 'reviewer'].includes(body.role) ? body.role : 'student';
    const district = safeText(body.district, 100).trim();
    const phone = safeText(body.phone, 40).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'A valid email address is required.');
    }
    if (!displayName) {
      throw new HttpError(400, 'Full name is required.');
    }

    let authUser;
    let tempPassword = '';
    try {
      authUser = await adminAuth.getUserByEmail(email);
    } catch {
      // User does not exist in Firebase Auth yet — create with temporary password
      tempPassword = generateTempPassword();
      authUser = await adminAuth.createUser({
        email,
        displayName,
        password: tempPassword,
        emailVerified: true
      });
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
      mustChangePassword: tempPassword ? true : false,
      updatedAt: now
    };

    if (agentCode) profileData.agentCode = agentCode;
    if (studentCode) profileData.agentCode = studentCode;

    await db.collection('profiles').doc(uid).set(profileData, {merge: true});

    // Create notification in notificationOutbox for record keeping
    const noticeId = newId();
    await db.collection('notificationOutbox').doc(noticeId).set({
      title: `Account Provisioned (${role.toUpperCase()} PORTAL)`,
      message: `User account created for ${displayName} (${email}). Temporary password: ${tempPassword || 'Existing account password'}.`,
      reference: agentCode || studentCode || 'ADMIN-PROVISION',
      recipient: 'all',
      recipientUid: uid,
      priority: 'important',
      event: 'user_provisioned',
      read: false,
      readBy: [],
      createdAt: now,
      updatedAt: now,
      createdBy: actor.displayName || actor.email,
      createdUid: actor.uid
    });

    await audit(actor.uid, 'user.provisioned', uid, {email, role, district, agentCode});

    return json({
      ok: true,
      uid,
      email,
      displayName,
      role,
      tempPassword: tempPassword || null,
      agentCode: agentCode || studentCode || null,
      message: `Account provisioned successfully for ${displayName} (${role.toUpperCase()}).`
    }, 201);
  } catch (e) {
    return fail(e);
  }
}
