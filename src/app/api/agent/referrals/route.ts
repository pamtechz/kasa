import type {NextRequest} from 'next/server';
import {rateLimit} from '@/lib/security';
import {loadIntake} from '@/lib/intake-server';
import {intakeWindow} from '@/lib/intake-policy';
import {publicFeatureFlags,requireReferralsEnabled} from '@/lib/feature-policy';
import {db} from '@/lib/firebase-admin';
import {operator, newId, safeText, sameOrigin} from '@/lib/security';
import {fail, json, HttpError} from '@/lib/errors';
import type {ApplicantRecord, SubmissionStatus} from '@/lib/types';
import {invalidateSubmissionsCache} from '@/lib/server-cache';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const agent = await operator(req, ['agent', 'super_admin', 'admin']);
    const agentUid = agent.role === 'agent' ? agent.uid : new URL(req.url).searchParams.get('agentUid') || agent.uid;

    const [records, forms, programmes, features] = await Promise.all([
      db.collection('submissions').where('agentId', '==', agentUid).limit(300).get(),
      db.collection('forms').where('published', '==', true).limit(100).get(),
      db.collection('programmes').where('published', '==', true).limit(150).get(),
      publicFeatureFlags()
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
        commission: x.commission
          ? {
              amount: Number(x.commission.amount),
              currency: 'ZMW',
              trigger: x.commission.trigger || 'cdf_approval',
              paidAt: x.commission.paidAt || null
            }
          : null
      };
    }).sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));

    return json({
      agent: {
        agentCode: agent.agentCode || '',
        district: agent.district || 'Unassigned',
        active: agent.active
      },
      forms: forms.docs
        .filter(d => d.data().kind === 'student')
        .map(d => ({slug: String(d.data().slug), title: String(d.data().title)})),
      programmes: programmes.docs.map(d=>String(d.data().title||'')).filter(Boolean).sort(),
      referralsEnabled: features.referralsEnabled,
      referrals
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const agent = await operator(req, ['agent', 'super_admin', 'admin']);
    await rateLimit(req,'agent-direct-referral',6,15);
    await requireReferralsEnabled();
    const body = await req.json();

    const candidateName = safeText(body.candidateName || body.name, 120);
    const phone = safeText(body.phone, 50);
    const email = safeText(body.email, 160).toLowerCase();
    const nrc = safeText(body.nrc, 40);
    const programme = safeText(body.programme, 150);
    const fundingMethod: 'cdf' | 'self_funded' = body.fundingMethod === 'self_funded' ? 'self_funded' : 'cdf';
    const district = safeText(body.district, 80) || agent.district || 'National';
    const note = safeText(body.note, 500);

    if (!candidateName) throw new HttpError(400, 'Candidate full name is required.');
    if (!phone) throw new HttpError(400, 'Candidate phone number is required.');
    if (!programme) throw new HttpError(400, 'Selected training programme is required.');
    // A direct referral may only be submitted for a published programme and
    // while an actual student application form accepts registrations.
    const [catalog,forms,policy,operations] = await Promise.all([
      db.collection('programmes').where('published','==',true).limit(150).get(),
      db.collection('forms').where('published','==',true).limit(100).get(),
      loadIntake(),
      db.collection('settings').doc('operations').get()
    ]);
    if(!catalog.docs.some(doc=>String(doc.data().title||'')===programme))
      throw new HttpError(400,'Select a currently published programme.');
    const studentForms=forms.docs.filter(doc=>doc.data().kind==='student');
    if(!studentForms.some(doc=>intakeWindow(policy,String(doc.data().slug||'')).open))
      throw new HttpError(403,'Student applications are currently closed.');
    const op=operations.data()||{};
    const configured=Number(fundingMethod==='cdf'
      ? op.commissionAmountCdf??op.commissionAmount??0
      : op.commissionAmountPaid??op.commissionAmount??0);
    if(!Number.isFinite(configured)||configured<0||configured>50000)
      throw new HttpError(500,'Referral commission settings require review.');

    const id = newId();
    const reference = `KASA-${new Date().getFullYear()}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    const newRecord: ApplicantRecord = {
      id,
      reference,
      formId: 'agent-direct-referral',
      formTitle: `${programme} (Agent Referral)`,
      formKind: 'student',
      formVersion: 1,
      status: 'submitted',
      answers: {
        'student-name': candidateName,
        name: candidateName,
        phone,
        email,
        nrc,
        program: programme,
        programme,
        district,
        'funding-type': fundingMethod,
        fundingMethod,
        agentNote: note
      },
      agentId: agent.uid,
      submittedAt: now,
      updatedAt: now,
      fundingMethod,
      commission: {
        amount: configured,
        currency: 'ZMW',
        trigger: fundingMethod === 'cdf' ? 'cdf_approval' : 'payment'
      },
      internalNotes: [
        {
          body: `Direct candidate enrollment registered by district agent ${agent.displayName || agent.email} (${agent.agentCode || 'Agent'}).${note ? ` Note: ${note}` : ''}`,
          at: now,
          by: agent.displayName || agent.email
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
