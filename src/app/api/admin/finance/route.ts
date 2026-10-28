import {db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {requireCapability, newId, safeText, sameOrigin, audit, digest} from '@/lib/security';
import {invalidateSubmissionsCache} from '@/lib/server-cache';
import {readApprovedFeeQuote} from '@/lib/approved-fee-quote';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    await requireCapability(req,'finance.read');

    // Read all pages; reporting just the first 500 can materially understate liabilities.
    // Bound the scan and expose incomplete results rather than inventing a full total.
    const docs: Array<Record<string, any>> = [];
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    let truncated = false;
    for (let page = 0; page < 40; page++) {
      let query = db.collection('submissions').where('formKind', '==', 'student')
        .orderBy('__name__').limit(250);
      if (cursor) query = query.startAfter(cursor);
      const snap = await query.get();
      docs.push(...snap.docs.map(d => ({id: d.id, ...d.data()})));
      if (snap.size < 250) break;
      cursor = snap.docs[snap.docs.length - 1];
      if (page === 39) truncated = true;
    }

    let totalRevenueExpected = 0;
    let totalPaymentsReceived = 0;
    let totalCdfApproved = 0;
    let totalCdfFundsReceived = 0;
    let missingFeeQuotes = 0;
    let paymentReconciliationRequired = 0;
    let outstandingBalance = 0;

    const studentLedger = docs.map((x: any) => {
      const answers = x.answers || {};
      const studentName = String(answers['full-name'] || answers['fullNames'] || 'Student Applicant');
      const programme = String(answers['programme-pathway'] || x.formTitle || 'General Agriculture');

      // An approved, versioned quote is the only valid source for a due balance.
      const quote = readApprovedFeeQuote(x.feeQuote);
      const totalPackage = quote?.total ?? null;
      if (totalPackage === null) missingFeeQuotes++;
      else totalRevenueExpected += totalPackage;
      const rawPaid = x.paymentVerification?.amount;
      const recorded = rawPaid == null ? 0 : Number(rawPaid);
      const paymentValid = Number.isFinite(recorded) && recorded >= 0 &&
        Math.abs(Math.round(recorded * 100) - recorded * 100) < 0.000001;
      if (!paymentValid) paymentReconciliationRequired++;
      const paidAmount = paymentValid ? recorded : 0;
      totalPaymentsReceived += paidAmount;
      const cdfApproved = x.fundingMethod === 'cdf' && ['cdf_approved','cdf_funds_received','commission_paid'].includes(x.status);
      if (cdfApproved && totalPackage !== null) totalCdfApproved += totalPackage; // sanctioned value, NOT received cash
      const remittance = x.cdfDisbursement;
      const cdfVerified = x.fundingMethod === 'cdf' && ['cdf_funds_received','commission_paid'].includes(x.status) &&
        Boolean(remittance?.verifiedAt && remittance?.bankReference && remittance?.governmentReference && remittance?.enrollmentConfirmed);
      const cdfReceived = cdfVerified ? Number(remittance.amount||0) : 0;
      if(cdfVerified&&Number.isFinite(cdfReceived)&&cdfReceived>0)totalCdfFundsReceived+=cdfReceived;
      const due = totalPackage === null ? null : Math.max(0,totalPackage - paidAmount - (Number.isFinite(cdfReceived)?cdfReceived:0));
      if (due !== null) outstandingBalance += due;

      return {
        id: x.id,
        reference: x.reference,
        studentName,
        programme,
        fundingMethod: x.fundingMethod || 'self_funded',
        status: x.status,
        totalPackage,
        feeStatus: quote ? 'approved' : 'requires_reconciliation',
        paidAmount,
        cdfFundsReceived: Number.isFinite(cdfReceived)?cdfReceived:0,
        outstandingBalance: due,
        paymentReference: x.paymentVerification?.reference || null,
        verifiedAt: x.paymentVerification?.verifiedAt || null,
        submittedAt: x.submittedAt
      };
    });

    return json({
      summary: {
        totalRevenueExpected,
        totalPaymentsReceived,
        outstandingBalance,
        totalCdfApproved,
        totalCdfFundsReceived,
        missingFeeQuotes,
        paymentReconciliationRequired,
        truncated,
        financialTotalsPartial: missingFeeQuotes > 0 || paymentReconciliationRequired > 0 || truncated
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
    const actor = await requireCapability(req,'finance.record');
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
      // Never allow a receipt to exceed a valid contractual quote. Unknown
      // historic quotes remain visible for staff reconciliation, not guessed.
      const approvedQuote = readApprovedFeeQuote(app.feeQuote);
      if (!approvedQuote) throw new HttpError(409, 'Approve and reconcile the application fee quote before accepting a new tuition receipt.');
      if (Math.round(newPaidTotal * 100) > Math.round(approvedQuote.total * 100)) {
        throw new HttpError(409, 'Receipt would exceed the approved programme fee. Reconcile the application before recording this amount.');
      }
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
