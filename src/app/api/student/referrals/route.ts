import type {NextRequest} from 'next/server';
import {adminAuth, db} from '@/lib/firebase-admin';
import {fail, HttpError, json} from '@/lib/errors';
import {rateLimit, safeText, sameOrigin} from '@/lib/security';
import {invalidateSubmissionsCache} from '@/lib/server-cache';
import type {ApplicantRecord} from '@/lib/types';
import {commissionDecision} from '@/lib/commission-eligibility';
import {studentReferralCode} from '@/lib/referral-identity';

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
  const profile=await db.collection('profiles').doc(token.uid).get();
  if(!profile.exists||profile.data()?.role!=='student'||profile.data()?.active!==true)
   throw new HttpError(403,'Active KASA student membership is required to use referrals.');
  return token;
}

export async function GET(req: NextRequest) {
  try {
    await rateLimit(req, 'student-referrals', 20, 10);
    const user = await verifiedStudent(req);

    const agentCode=await studentReferralCode(user.uid);

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

    const origin = process.env.APP_URL || 'https://kasaschool.vercel.app';
    const referralsEnabled=ops.referralsEnabled!==false;
    const referralLink = referralsEnabled?`${origin}/apply/student-enrollment?ref=${agentCode}`:'';

    return json({
      agentCode,
      referralLink,referralsEnabled,
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

/** Candidate creation must use the published-form intake path for deduplication and evidence validation. */
export async function POST(req: NextRequest) {
 try{
  sameOrigin(req);
  await verifiedStudent(req);
  throw new HttpError(409,'Register referred candidates using your official referral link. The published application form enforces intake, identity, document and duplicate checks.');
 }catch(e){return fail(e);}
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

