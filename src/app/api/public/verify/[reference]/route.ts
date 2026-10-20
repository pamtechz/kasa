import {NextRequest, NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  {params}: {params: Promise<{reference: string}>}
) {
  try {
    const {reference} = await params;
    const cleanRef = String(reference || '').trim().toUpperCase();

    if (!cleanRef) {
      return NextResponse.json({error: 'Reference required.'}, {status: 400});
    }

    const snap = await db
      .collection('submissions')
      .where('reference', '==', cleanRef)
      .limit(1)
      .get();

    if (snap.empty) {
      return NextResponse.json({
        verified: false,
        reference: cleanRef,
        message: 'No official KASA application found matching this reference number.'
      }, {status: 404});
    }

    const data = snap.docs[0].data();
    const answers = data.answers || {};

    const studentName = String(
      answers['full-name'] || answers['student-name'] || answers['fullNames'] || 'Student Applicant'
    );
    const programmeTitle = String(
      answers['programme-pathway'] || answers['preferred-programme'] || answers['program'] || data.formTitle || 'General Agriculture'
    );

    return NextResponse.json({
      verified: true,
      reference: data.reference,
      studentName,
      programmeTitle,
      fundingMethod: data.fundingMethod === 'cdf' ? 'Constituency Development Fund (CDF)' : 'Self-Funded / Private',
      status: data.status,
      submittedAt: data.submittedAt,
      updatedAt: data.updatedAt || data.submittedAt,
      message: 'Official KASA document verification confirmed. This offer is authentic and recognized by the KASA Directorate.'
    });
  } catch (e) {
    return NextResponse.json({error: e instanceof Error ? e.message : 'Verification lookup failed.'}, {status: 500});
  }
}
