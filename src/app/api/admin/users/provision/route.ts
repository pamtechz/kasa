import {db} from '@/lib/firebase-admin';
import {ensureSchoolIdentity} from '@/lib/account-onboarding';
import {fail, json, HttpError} from '@/lib/errors';
import {operator, newId, sameOrigin, safeText, audit} from '@/lib/security';
import {FieldValue} from 'firebase-admin/firestore';

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

    // A School admin can create a real Firebase Auth account and School profile.
    // Users choose their own passwords and must verify their own email.
    const account=await ensureSchoolIdentity({
      email,displayName,schoolRole:role as 'student'|'agent'|'admin'|'reviewer',
      actorUid:actor.uid
    });
    const previousRole = account.profile.role;
    if(previousRole==='marathon_only')throw new HttpError(409,'This is a Marathon-only account. Manage its access from Marathon Team; it cannot be assigned a School role through School provisioning.');
    if (previousRole === 'super_admin') throw new HttpError(403, 'Super administrator accounts cannot be provisioned here.');
    if (actor.role !== 'super_admin' && ['admin','reviewer'].includes(previousRole)) {
      throw new HttpError(403, 'Only a super administrator can modify staff accounts.');
    }

    const uid = account.uid;
    const now = new Date().toISOString();
    const agentCode = role === 'agent' ? `KASA-AGT-${uid.slice(0, 6).toUpperCase()}` : undefined;
    const studentCode = role === 'student' ? `KASA-STU-${uid.slice(0, 6).toUpperCase()}` : undefined;

    // Firestore sentinels are valid writes but not Profile string fields.
    const profileData: Record<string, unknown> = {
      uid,
      email,
      displayName,
      role: role as any,
      active: true,
      ...(phone ? {phone} : {}),
      ...(district ? {district} : {}),
      agentCode: agentCode || FieldValue.delete(),
      studentCode: studentCode || FieldValue.delete(),
      updatedAt: now
    };

    await db.collection('profiles').doc(uid).set(profileData, {merge: true});

    // Create notification in notificationOutbox for record keeping
    const noticeId = newId();
    await db.collection('notificationOutbox').doc(noticeId).set({
      title: `Account Provisioned (${role.toUpperCase()} PORTAL)`,
      message: `${account.authCreated ? 'New' : 'Existing'} School user ${displayName} (${email}) was assigned the ${role} role${account.verificationPending ? ' (pending email verification)' : ''}.`,
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

    await audit(actor.uid, 'user.provisioned', uid, {email, role, district, accountCreated:account.authCreated, ...(agentCode ? {agentCode} : {})});

    return json({
      ok: true,
      uid,
      email,
      displayName,
      role,
      tempPassword: null,
      accountCreated: account.authCreated,
      onboardingEmailSent: account.onboardingEmailSent,
      verificationPending: account.verificationPending,
      agentCode: agentCode || studentCode || null,
      message: account.verificationPending
        ? account.onboardingEmailSent
          ? `School account created for ${displayName}; password setup email requested. The user must verify their email before sign-in.`
          : `School account prepared for ${displayName}. Ask the user to select Forgot password on KASA School login, then verify their email.`
        : `School account updated for ${displayName} (${role.toUpperCase()}).`
    }, 201);
  } catch (e) {
    return fail(e);
  }
}
