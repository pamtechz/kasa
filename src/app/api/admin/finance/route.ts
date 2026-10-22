import {db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {requirePermission,operator, newId, safeText, sameOrigin, audit, digest} from '@/lib/security';
import {invalidateSubmissionsCache} from '@/lib/server-cache';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    await requirePermission(req,'finance.read');

    const snap = await db.collection('submissions').where('formKind', '==', 'student').limit(500).get();
    const docs = snap.docs.map(d => ({id: d.id, ...d.data()}));

    let totalRevenueExpected = 0;
    let totalPaymentsReceived = 0;
    let totalCdfApproved = 0;

    const studentLedger = docs.map((x: any) => {
      const answers = x.answers || {};
      const studentName = String(answers['full-name'] || answers['fullNames'] || 'Student Applicant');
      const programme = String(answers['programme-pathway'] || x.formTitle || 'General Agriculture');

      let tuitionFee = 8200; // Default approved tuition fee
      if (programme.includes('K4,800')) tuitionFee = 4800;
      else if (programme.includes('K2,600')) tuitionFee = 2600;
      else if (programme.includes('K3,000')) tuitionFee = 3000;

      const isBoarding = String(answers['package-option'] || answers['attendance'] || '').toLowerCase().includes('boarding');
      const totalPackage = isBoarding ? tuitionFee + 9000 : tuitionFee;

      totalRevenueExpected += totalPackage;

      const paidAmount = Number(x.paymentVerification?.amount) || 0;
      totalPaymentsReceived += paidAmount;

      if (x.fundingMethod === 'cdf' && ['cdf_approved', 'commission_paid'].includes(x.status)) {
        totalCdfApproved += totalPackage;
      }

      return {
        id: x.id,
        reference: x.reference,
        studentName,
        programme,
        fundingMethod: x.fundingMethod || 'self_funded',
        status: x.status,
        totalPackage,
        paidAmount,
        outstandingBalance: Math.max(0, totalPackage - paidAmount),
        paymentReference: x.paymentVerification?.reference || null,
        verifiedAt: x.paymentVerification?.verifiedAt || null,
        submittedAt: x.submittedAt
      };
    });

    return json({
      summary: {
        totalRevenueExpected,
        totalPaymentsReceived,
        outstandingBalance: Math.max(0, totalRevenueExpected - totalPaymentsReceived - totalCdfApproved),
        totalCdfApproved
      },
      ledger: studentLedger
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const actor = await requirePermission(req,'finance.manage');
    const body = await req.json();

    const submissionId = safeText(body.submissionId, 60);
    const amountPaid = Number(body.amountPaid) || 0;
    const paymentMethod = safeText(body.paymentMethod, 60) || 'Bank Deposit';
    const receiptReference = safeText(body.receiptReference, 160);
    const note = safeText(body.note, 500);

    if (!submissionId) throw new HttpError(400, 'Submission ID is required.');
    if (!Number.isFinite(amountPaid) || amountPaid <= 0 || amountPaid > 10000000 || Math.abs(Math.round(amountPaid * 100) - amountPaid * 100) > 0.000001) throw new HttpError(400, 'Enter a valid positive payment amount in ZMW with no more than two decimal places.');
    if (!receiptReference || receiptReference.length < 4) throw new HttpError(400, 'Valid receipt or bank reference is required.');

    const ref = db.collection('submissions').doc(submissionId);
    const now = new Date().toISOString();
    // Recording a receipt never promotes an application to payment_verified.
    // Successful enrollment and commission eligibility must be confirmed by
    // the guarded application status transition API.
    const verificationRef = db.collection('fundingVerifications')
      .doc(digest('payment:' + receiptReference.toLowerCase()));
    let newPaidTotal = 0;
    let reference = '';

    await db.runTransaction(async tx => {
      const [snap, prior] = await Promise.all([tx.get(ref), tx.get(verificationRef)]);
      if (!snap.exists) throw new HttpError(404, 'Student application record not found.');
      const app = snap.data()!;
      if (app.formKind !== 'student') throw new HttpError(400, 'Tuition receipts require a student application.');
      if (!['letter_issued', 'payment_verified'].includes(String(app.status))) {
        throw new HttpError(409, 'The application must have an issued acceptance letter before tuition receipts are recorded.');
      }
      if (app.fundingMethod === 'cdf') throw new HttpError(409, 'CDF-sponsored applications cannot use the self-funded tuition receipt workflow.');
      if (prior.exists) throw new HttpError(409, 'This receipt/reference has already been recorded.');

      const existingPaid = Number(app.paymentVerification?.amount || 0);
      if (!Number.isFinite(existingPaid) || existingPaid < 0) {
        throw new HttpError(409, 'Existing student ledger requires reconciliation.');
      }
      newPaidTotal = existingPaid + amountPaid;
      reference = String(app.reference || '');
      const updates: Record<string, unknown> = {
        updatedAt: now,
        paymentVerification: {
          ...(app.paymentVerification || {}),
          reference: receiptReference,
          amount: newPaidTotal,
          currency: 'ZMW',
          paymentMethod,
          recordedBy: actor.uid,
          recordedAt: now,
          verificationPending: app.status !== 'payment_verified'
        }
      };
      if (note) {
        updates.internalNotes = [...(app.internalNotes || []).slice(-79), {
          body: `[FINANCE RECORD] Paid ZMW ${amountPaid.toFixed(2)} via ${paymentMethod} (Receipt: ${receiptReference}). ${note}`,
          at: now,
          by: actor.uid
        }];
      }
      // Preserve the current admissions state and associated funding method.
      // A separate privileged review must advance the enrollment status.
      if (app.status !== 'payment_verified') {
        updates.fundingStatus = 'payment_recorded_pending_enrollment_verification';
      }

      tx.create(verificationRef, {
        submissionId,
        kind: 'payment_receipt',
        reference: receiptReference,
        amount: amountPaid,
        totalPaidToDate: newPaidTotal,
        paymentMethod,
        recordedBy: actor.uid,
        recordedAt: now,
        verificationPending: app.status !== 'payment_verified'
      });
      tx.update(ref, updates);
    });

    invalidateSubmissionsCache();
    await audit(actor.uid, 'finance.payment_recorded', submissionId, {amountPaid, receiptReference, paymentMethod});

    return json({
      ok: true,
      submissionId,
      totalPaidToDate: newPaidTotal,
      message: `Tuition receipt of ZMW ${amountPaid.toFixed(2)} recorded for ${reference}. Enrollment verification remains a separate approval step.`
    }, 201);
  } catch (e) {
    return fail(e);
  }
}
