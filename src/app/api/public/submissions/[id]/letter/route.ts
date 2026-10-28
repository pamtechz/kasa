import {readApprovedFeeQuote} from '@/lib/approved-fee-quote';
import {loadCustomAcceptancePdf} from '@/lib/custom-acceptance-pdf';
import {authorizeSubmissionDocument} from '@/lib/submission-access';
import {db} from '@/lib/firebase-admin';
import {fail, HttpError} from '@/lib/errors';
import {generateAcceptancePackPdf, type AcceptancePackData} from '@/lib/pdf-acceptance-pack';
import {
  type AcceptanceLetterConfig,
  defaultAcceptanceLetterConfig,
  acceptanceLetterConfigSchema
} from '@/lib/acceptance-letter-config';

export const runtime = 'nodejs';

export async function GET(req: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const {id} = await params;
    const snap = await db.collection('submissions').doc(id).get();
    if (!snap.exists) throw new HttpError(404, 'Application not found.');
    const data = snap.data()!;
    await authorizeSubmissionDocument(req,data);

    if (!['letter_issued','cdf_submitted','cdf_approved','cdf_funds_received','payment_verified','commission_paid'].includes(String(data.status))) {
      throw new HttpError(403,'This application does not yet have an approved or conditional acceptance letter.');
    }

    const approvedFee = readApprovedFeeQuote(data.feeQuote);
    const legacyIssued = ['letter_issued','cdf_submitted','cdf_approved','payment_verified','commission_paid'].includes(String(data.status));
    if (!approvedFee && !legacyIssued)
      throw new HttpError(409,'An approved documented fee quote is required before an acceptance pack can be generated.');
    // Previously issued letters remain retrievable, without retrospectively
    // replacing their unknown amounts with fabricated tuition or board rates.
    const money = (amount:number) => 'K' + amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const academicFees = approvedFee ? money(approvedFee.tuition + approvedFee.practical + approvedFee.administration) : 'Reconciliation required';
    const boardingMealsFees = approvedFee ? money(approvedFee.accommodation + approvedFee.food) : 'Reconciliation required';
    const totalFees = approvedFee ? money(approvedFee.total) : 'Unverified';
    const approvedBreakdown = approvedFee ? {...approvedFee,approvalReference:String(data.feeQuote?.approvalReference||''),
     version:approvedFee.version} : undefined;
    
    const answers = data.answers || {};

    let letterConfig: AcceptanceLetterConfig = defaultAcceptanceLetterConfig;
    try {
      const cfgSnap = await db.collection('settings').doc('acceptanceLetter').get();
      if (cfgSnap.exists) {
        const parsed = acceptanceLetterConfigSchema.safeParse(cfgSnap.data());
        if (parsed.success) letterConfig = parsed.data;
      }
    } catch {}

    // Load only KASA uploads or explicitly approved HTTPS hosts; never
    // follow redirects or allow unbounded external PDF responses.
    if (letterConfig.packSource === 'custom' && letterConfig.customPdf?.url) {
      try {
        const bytes = await loadCustomAcceptancePdf(letterConfig.customPdf);
        return new Response(new Uint8Array(bytes), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="KASA-Acceptance-${data.reference}.pdf"`,
            'Cache-Control': 'private, no-store'
          }
        });
      } catch (error) {
        console.error('Unable to deliver custom acceptance PDF:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    const studentName = String(
      answers['full-name'] || answers['student-name'] || answers['fullNames'] || 'Applicant'
    );
    const programme = String(
      answers['programme-pathway'] || answers['preferred-programme'] || answers['program'] || data.formTitle || 'General Agriculture'
    );
    const intake = String(
      answers['intake'] || answers['intakeAndYear'] || '2027 January Intake'
    );
    const nrcNumber = String(answers['nrc-number'] || answers['nrcNumber'] || '');
    const phone = String(answers['phone'] || answers['mobileNumber'] || '');
    const address = String(answers['residentialAddress'] || answers['district'] || 'Lusaka / Central Province, Zambia');

    const isTeve = programme.toLowerCase().includes('teveta');
    const isShort = programme.toLowerCase().includes('short');
    const category = isTeve ? 'General Agriculture (TEVETA)' : isShort ? 'Independent short course' : 'Agri-Sport';

    // Attendance is selected from the independently reconciled package, never
    // used to infer prices from student-entered text.
    const isBoarding = String(data.feeQuote?.packageId||'').includes('boarding');


    const packData: AcceptancePackData = {
      reference: data.reference,
      date: new Date(data.submittedAt || Date.now()).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'}),
      studentName,
      address,
      programme,
      category,
      pathway: isTeve ? 'Trade Test Level II / Level III' : 'KASA Practical Apprenticeship',
      duration: isShort ? '8 Weeks (2 Months)' : programme.includes('3 Months') ? '3 Months' : '6 Months (740 hrs)',
      intake,
      attendance: isBoarding ? 'Boarding' : 'Day',
      commencementDate: 'January 2027',
      reportingDate: 'Admissions Office, Kamaila Campus',
      reportingTime: '08:00 - 15:00 hrs',
      acceptanceDeadline: '14 days from issue date',
      academicFees,
      boardingMealsFees,
      totalFees,
      initialPayment: 'Per approved payment agreement',
      approvedBreakdown,
      suppressProposedFees: !approvedFee,
      signatory: letterConfig.letter.signatory || 'Authorised Admissions Officer',
      signatoryTitle: letterConfig.letter.signatoryTitle || 'Admissions Directorate / Registrar',
      fundingMethod: data.fundingMethod || 'CDF',
      nrcNumber,
      phone
    };

    const bytes = await generateAcceptancePackPdf(packData, letterConfig);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="KASA-Acceptance-${data.reference}.pdf"`,
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (e) {
    return fail(e);
  }
}
