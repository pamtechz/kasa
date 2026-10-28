import type {NextRequest} from 'next/server';
import {adminAuth, db} from '@/lib/firebase-admin';
import {fail, HttpError, json} from '@/lib/errors';
import {rateLimit, safeText, newId, sameOrigin} from '@/lib/security';
import {invalidateSubmissionsCache} from '@/lib/server-cache';
import type {ApplicantRecord} from '@/lib/types';
import {commissionDecision} from '@/lib/commission-eligibility';

export const runtime = 'nodejs';

async function verifiedStudent(req: Request) {
  const h = req.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ')) throw new HttpError(401, 'Sign in to access your student referral account.');
  let token;
  try {
    token = await adminAuth.verifyIdToken(h.slice(7), true);
  } catch {
    throw new HttpError(401, 'Your session has expired.');
  }
  if (!token.email_verified || !token.email) throw new HttpError(403, 'Verify your email to participate in the referral program.');
  return token;
}

export async function GET(req: NextRequest) {
  try {
    await rateLimit(req, 'student-referrals', 20, 10);
    const user = await verifiedStudent(req);

    // 1. Get or create student profile with referral code
    const profileRef = db.collection('profiles').doc(user.uid);
    const profileSnap = await profileRef.get();
    let agentCode = profileSnap.data()?.agentCode;

    if (!agentCode) {
      agentCode = `KASA-STU-${user.uid.slice(0, 6).toUpperCase()}`;
      await profileRef.set({
        uid: user.uid,
        email: user.email || '',
        displayName: user.name || (user.email ? user.email.split('@')[0] : 'Student'),
        role: profileSnap.data()?.role || 'student',
        active: true,
        agentCode,
        isStudent: true,
        updatedAt: new Date().toISOString()
      }, {merge: true});
    }

    // 2. Fetch referral settings for commission rates
    const opsSnap = await db.collection('settings').doc('operations').get();
    const ops = opsSnap.data() || {};
    const cdfRate = Number(ops.commissionAmountCdf || 0);
    const paidRate = Number(ops.commissionAmountPaid || 0);

    // 3. Query all submissions referred by this student
    const [subByAgentId, subByCode] = await Promise.all([
      db.collection('submissions').where('agentId', '==', user.uid).get(),
      db.collection('submissions').where('answers.agentCode', '==', agentCode).get()
    ]);

    const referralsMap = new Map();
    for (const doc of [...subByAgentId.docs, ...subByCode.docs]) {
      const d = doc.data();
      referralsMap.set(doc.id, {
        id: doc.id,
        reference: d.reference,
        candidateName: String(d.answers?.['full-name'] || d.answers?.['student-name'] || 'Applicant'),
        programme: String(d.answers?.['programme-pathway'] || d.formTitle || 'General Agriculture'),
        status: d.status,
        fundingMethod: d.fundingMethod,
        submittedAt: d.submittedAt,
        commissionEarned: commissionDecision(d).eligible ? Number(d.commission.amount) : 0
      });
    }

    const referrals = Array.from(referralsMap.values()).sort((a, b) =>
      String(b.submittedAt).localeCompare(String(a.submittedAt))
    );

    const totalEarned = referrals.reduce((sum, r) => sum + r.commissionEarned, 0);
    const successfulCount = referrals.filter(r => r.commissionEarned > 0).length;

    const origin = req.headers.get('origin') || process.env.APP_URL || 'http://localhost:3001';
    const referralLink = `${origin}/apply/student-enrollment?ref=${agentCode}`;

    return json({
      agentCode,
      referralLink,
      referralsCount: referrals.length,
      successfulCount,
      totalEarned,
      currency: 'ZMW',
      cdfRate,
      paidRate,
      referrals
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    await rateLimit(req, 'student-referral-submit', 10, 10);
    const user = await verifiedStudent(req);
    const body = await req.json();

    const candidateName = safeText(body.candidateName || body.name, 120);
    const phone = safeText(body.phone, 50);
    const email = safeText(body.email, 160).toLowerCase();
    const nrc = safeText(body.nrc, 40);
    const programme = safeText(body.programme, 150);
    const fundingMethod: 'cdf' | 'self_funded' = body.fundingMethod === 'self_funded' ? 'self_funded' : 'cdf';
    const district = safeText(body.district, 80);
    const note = safeText(body.note, 500);

    if (!candidateName) throw new HttpError(400, 'Candidate full name is required.');
    if (!phone) throw new HttpError(400, 'Candidate phone number is required.');
    if (!programme) throw new HttpError(400, 'Selected training programme is required.');

    // Fetch referral settings for commission rates
    const opsSnap = await db.collection('settings').doc('operations').get();
    const ops = opsSnap.data() || {};
    const cdfRate = Number(ops.commissionAmountCdf ?? ops.commissionAmount ?? 100);
    const paidRate = Number(ops.commissionAmountPaid ?? ops.commissionAmount ?? 150);
    // A submitted referral is not a commission; the rates are informational.

    // Get student profile's agentCode
    const profileRef = db.collection('profiles').doc(user.uid);
    const profileSnap = await profileRef.get();
    let agentCode = profileSnap.data()?.agentCode;
    if (!agentCode) {
      agentCode = `KASA-STU-${user.uid.slice(0, 6).toUpperCase()}`;
      await profileRef.set({
        uid: user.uid,
        email: user.email || '',
        displayName: user.name || (user.email ? user.email.split('@')[0] : 'Student'),
        role: profileSnap.data()?.role || 'student',
        active: true,
        agentCode,
        isStudent: true,
        updatedAt: new Date().toISOString()
      }, {merge: true});
    }

    const id = newId();
    const reference = `KASA-${new Date().getFullYear()}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    const newRecord: ApplicantRecord = {
      id,
      reference,
      formId: 'student-direct-referral',
      formTitle: `${programme} (Student Referral)`,
      formKind: 'student',
      formVersion: 1,
      status: 'submitted',
      answers: {
        'student-name': candidateName,
        name: candidateName,
        phone,
        email: email || `${phone.replace(/\D/g, '')}@kasa.referral.zm`,
        nrc,
        program: programme,
        programme,
        district,
        'funding-type': fundingMethod,
        fundingMethod,
        agentCode,
        studentNote: note
      },
      agentId: user.uid,
      submittedAt: now,
      updatedAt: now,
      fundingMethod,
      internalNotes: [
        {
          body: `Direct candidate referral registered by enrolled student ${user.name || user.email} (${agentCode}).${note ? ` Note: ${note}` : ''}`,
          at: now,
          by: user.name || user.email || 'Student'
        }
      ]
    };

    await db.collection('submissions').doc(id).set(newRecord);
    invalidateSubmissionsCache();

    return json({ok: true, id, reference, referral: newRecord});
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const user = await verifiedStudent(req);
    const body = await req.json();
    const id = safeText(body.id, 64);
    if (!id) throw new HttpError(400, 'Referral ID is required.');

    const ref = db.collection('submissions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Referral record not found.');
    const record = snap.data() as ApplicantRecord;

    if (record.agentId !== user.uid) {
      throw new HttpError(403, 'You can only update your own candidate referrals.');
    }

    if (!['submitted', 'under_review', 'needs_information'].includes(record.status)) {
      throw new HttpError(400, 'Applications already approved or processed cannot be edited online.');
    }

    const answers = record.answers || {};
    if (typeof body.phone === 'string' && body.phone.trim()) {
      answers.phone = safeText(body.phone, 50);
    }
    if (typeof body.candidateName === 'string' && body.candidateName.trim()) {
      answers['student-name'] = safeText(body.candidateName, 120);
      answers.name = safeText(body.candidateName, 120);
    }
    if (typeof body.note === 'string') {
      answers.studentNote = safeText(body.note, 500);
    }

    const now = new Date().toISOString();
    await ref.update({
      answers,
      updatedAt: now
    });
    invalidateSubmissionsCache();

    return json({ok: true, id});
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const user = await verifiedStudent(req);
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) throw new HttpError(400, 'Referral ID is required.');

    const ref = db.collection('submissions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Referral record not found.');
    const record = snap.data() as ApplicantRecord;

    if (record.agentId !== user.uid) {
      throw new HttpError(403, 'You can only withdraw your own referrals.');
    }

    if (record.status !== 'submitted') {
      throw new HttpError(400, 'Only pending applications that have not yet begun institutional review can be withdrawn.');
    }

    await ref.delete();
    invalidateSubmissionsCache();

    return json({ok: true, deletedId: id});
  } catch (e) {
    return fail(e);
  }
}

