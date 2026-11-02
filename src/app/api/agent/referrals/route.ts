import {db} from '@/lib/firebase-admin';
import {operator, newId, safeText, sameOrigin} from '@/lib/security';
import {fail, json, HttpError} from '@/lib/errors';
import type {ApplicantRecord, SubmissionStatus} from '@/lib/types';
import {commissionDecision} from '@/lib/commission-eligibility';
import {invalidateSubmissionsCache} from '@/lib/server-cache';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const agent = await operator(req, ['agent', 'super_admin', 'admin']);
    const agentUid = agent.role === 'agent' ? agent.uid : new URL(req.url).searchParams.get('agentUid') || agent.uid;

    const [records, forms] = await Promise.all([
      db.collection('submissions').where('agentId', '==', agentUid).limit(300).get(),
      db.collection('forms').where('published', '==', true).limit(100).get()
    ]);

    const referrals = records.docs.map(d => {
      const x = d.data() as ApplicantRecord;
      const answers = x.answers || {};
      const candidateName =
        (answers['student-name'] as string) ||
        (answers['full-name'] as string) ||
        (answers['name'] as string) ||
        (x as any).studentName ||
        'Candidate';
      const phone = (answers['phone'] as string) || (answers['telephone'] as string) || (x as any).phone || '';
      const programme = (answers['program'] as string) || (answers['course'] as string) || (x as any).programme || x.formTitle || '';

      return {
        id: d.id,
        reference: x.reference,
        candidateName,
        phone,
        programme,
        fundingMethod: x.fundingMethod || 'cdf',
        submittedAt: x.submittedAt,
        status: x.status,
        note: (answers['agentNote'] as string) || '',
        commission: commissionDecision(x as ApplicantRecord).eligible&&x.commission
          ? {
              amount: Number(x.commission.amount),
              currency: 'ZMW',
              trigger: x.commission.trigger || 'payment',
              paidAt: x.commission.paidAt || null
            }
          : null
      };
    }).sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));

    const ownerSnap=agentUid===agent.uid?null:await db.collection('profiles').doc(agentUid).get();
    const owner=ownerSnap?.data()||agent;
    const agentCode=String(owner.agentCode||'');
    const studentForm=forms.docs.find(d=>d.data().kind==='student');
    const slug=studentForm?String(studentForm.data().slug):'student-enrollment';
    const referralLink=agentCode?
      (process.env.APP_URL||'https://kasaschool.vercel.app')+'/apply/'+encodeURIComponent(slug)+'?ref='+encodeURIComponent(agentCode):'';
    const eligible=referrals.filter(item=>item.commission!==null);
    return json({
      agent: {
        agentCode,
        district: owner.district || 'Unassigned',
        active: owner.active
      },
      agentCode,referralLink,
      referralsCount:referrals.length,
      successfulCount:eligible.length,
      totalEarned:eligible.reduce((sum,item)=>sum+(item.commission?.amount||0),0),
      pendingCommission:eligible.filter(item=>!item.commission?.paidAt).reduce((sum,item)=>sum+(item.commission?.amount||0),0),
      paidCommission:eligible.filter(item=>Boolean(item.commission?.paidAt)).reduce((sum,item)=>sum+(item.commission?.amount||0),0),
      currency:'ZMW',
      forms: forms.docs
        .filter(d => d.data().kind === 'student')
        .map(d => ({slug: String(d.data().slug), title: String(d.data().title)})),
      referrals
    });
  } catch (e) {
    return fail(e);
  }
}

/** Candidate creation must use the published-form intake path for deduplication and evidence validation. */
export async function POST(req: Request) {
 try{
  sameOrigin(req);
  await operator(req, ['agent', 'super_admin', 'admin']);
  throw new HttpError(409,'Register referred candidates using your official referral link. The published application form enforces intake, identity, document and duplicate checks.');
 }catch(e){return fail(e);}
}

export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const agent = await operator(req, ['agent', 'super_admin', 'admin']);
    const body = await req.json();
    const id = safeText(body.id, 64);
    if (!id) throw new HttpError(400, 'Referral ID is required.');

    const ref = db.collection('submissions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Referral record not found.');
    const record = snap.data() as ApplicantRecord;

    if (agent.role === 'agent' && record.agentId !== agent.uid) {
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
      answers.agentNote = safeText(body.note, 500);
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
    const agent = await operator(req, ['agent', 'super_admin', 'admin']);
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) throw new HttpError(400, 'Referral ID is required.');

    const ref = db.collection('submissions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Referral record not found.');
    const record = snap.data() as ApplicantRecord;

    if (agent.role === 'agent' && record.agentId !== agent.uid) {
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
