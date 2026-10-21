import {authorizeSubmissionDocument} from '@/lib/submission-access';
import {db} from '@/lib/firebase-admin';
import {fail, HttpError} from '@/lib/errors';
import {generateStudentIdCardPdf, type StudentIdCardData} from '@/lib/pdf-student-id';

export const runtime = 'nodejs';

export async function GET(req: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const {id} = await params;
    const snap = await db.collection('submissions').doc(id).get();
    if (!snap.exists) throw new HttpError(404, 'Student record not found.');
    const data = snap.data()!;
    await authorizeSubmissionDocument(req,data);

    if (!['cdf_approved','payment_verified','commission_paid'].includes(String(data.status))) {
      throw new HttpError(403,'A student ID is available only after verified enrollment.');
    }

    const answers = data.answers || {};
    const studentName = String(answers['full-name'] || answers['fullNames'] || 'Student Applicant');
    const nrcNumber = String(answers['nrc-number'] || answers['nrcNumber'] || 'On file');
    const programmeTitle = String(answers['programme-pathway'] || data.formTitle || 'General Agriculture');

    const cardData: StudentIdCardData = {
      reference: data.reference,
      studentName,
      nrcNumber,
      programmeTitle,
      intakeBatch: String(answers['intake'] || '2027 Intake'),
      issueDate: new Date(data.submittedAt || Date.now()).toLocaleDateString('en-GB'),
      expiryDate: '31/12/2027'
    };

    const pdfBytes = await generateStudentIdCardPdf(cardData);
    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="KASA-StudentID-${data.reference}.pdf"`,
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (e) {
    return fail(e);
  }
}
