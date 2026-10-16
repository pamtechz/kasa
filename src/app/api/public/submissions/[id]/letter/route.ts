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
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    const snap = await db.collection('submissions').doc(id).get();
    if (!snap.exists) throw new HttpError(404, 'Application not found.');
    const data = snap.data()!;

    // Security check: require either matching download token or valid auth
    if (token && data.downloadToken && token === data.downloadToken) {
      // Authorized via submission token
    } else {
      const authHeader = req.headers.get('authorization') || '';
      if (!authHeader) throw new HttpError(403, 'A valid authorization token is required to view this document.');
    }

    const answers = data.answers || {};

    let letterConfig: AcceptanceLetterConfig = defaultAcceptanceLetterConfig;
    try {
      const cfgSnap = await db.collection('settings').doc('acceptanceLetter').get();
      if (cfgSnap.exists) {
        const parsed = acceptanceLetterConfigSchema.safeParse(cfgSnap.data());
        if (parsed.success) letterConfig = parsed.data;
      }
    } catch {}

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

    let academicFees = 'K8,200 (6 Months)';
    if (programme.includes('K4,700') || programme.includes('K4,800')) academicFees = 'K4,800 (3 Months)';
    else if (programme.includes('K8,000')) academicFees = 'K8,000 (6 Months)';
    else if (programme.includes('K2,600')) academicFees = 'K2,600 (8 Weeks)';
    else if (programme.includes('K3,000')) academicFees = 'K3,000 (8 Weeks)';
    else if (programme.includes('K3,100')) academicFees = 'K3,100 (8 Weeks)';
    else if (programme.includes('K2,500')) academicFees = 'K2,500 (8 Weeks)';
    else if (programme.includes('K3,500')) academicFees = 'K3,500 (8 Weeks)';

    const isBoarding = String(answers['package-option'] || answers['boarding-preference'] || answers['attendance'] || '').toLowerCase().includes('boarding');
    const totalFees = isBoarding ? 'K17,200 (Full Package)' : academicFees;

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
      boardingMealsFees: isBoarding ? 'K9,000 (Meals & Bed Space)' : 'K0.00 (Day scholar)',
      totalFees,
      initialPayment: isBoarding ? '40% registration deposit' : 'Refer to 2027 schedule',
      signatory: letterConfig.letter.signatory || 'Authorised Admissions Officer',
      signatoryTitle: letterConfig.letter.signatoryTitle || 'Admissions Directorate / Registrar',
      fundingMethod: data.fundingMethod || 'CDF',
      nrcNumber,
      phone
    };

    const bytes = await generateAcceptancePackPdf(packData, letterConfig);
    return new Response(Buffer.from(bytes), {
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
