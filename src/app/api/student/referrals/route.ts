import type {NextRequest} from 'next/server';
import {adminAuth, db} from '@/lib/firebase-admin';
import {fail, HttpError, json} from '@/lib/errors';
import {rateLimit} from '@/lib/security';

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
    const cdfRate = Number(ops.commissionAmountCdf ?? ops.commissionAmount ?? 100);
    const paidRate = Number(ops.commissionAmountPaid ?? ops.commissionAmount ?? 150);

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
        commissionEarned: ['accepted', 'letter_issued', 'cdf_approved', 'payment_verified', 'commission_paid'].includes(d.status)
          ? (d.fundingMethod === 'cdf' ? cdfRate : paidRate)
          : 0
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
