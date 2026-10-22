import {NextRequest,NextResponse} from 'next/server';
import {fail} from '@/lib/errors';
import {requirePermission} from '@/lib/security';
import {generateEnrollmentFormPdf} from '@/lib/pdf-enrollment-form';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req,'acceptance.manage');
    const body = await req.json().catch(() => ({}));
    const offsets = body?.config?.enrollmentFormOffsets || body?.offsets || {};

    const sampleData = {
      reference: 'KASA-2027-PREVIEW',
      applicationDate: new Date().toLocaleDateString('en-GB'),
      intakeAndYear: 'January 2027 Intake',
      programmeTitle: 'General Agriculture (TEVETA Level II)',
      trainingArea: 'General Agriculture',
      fullNames: 'CHISAMBA MUMBA APPLICANT',
      dob: '15/05/2004',
      gender: 'Male',
      nationality: 'Zambian',
      nrcNumber: '123456/10/1',
      mobileNumber: '+260 97 123 4567',
      whatsappNumber: '+260 97 123 4567',
      email: 'applicant@example.com',
      residentialAddress: 'House 40, Kamaila Farm Block',
      district: 'Chisamba',
      province: 'Central Province',
      highestGrade: 'Grade 12 Certificate',
      schoolInstitution: 'Chisamba Secondary School',
      qualificationYear: '2025',
      occupation: 'Student Applicant',
      guardianName: 'MUMBA SENIOR GUARDIAN',
      guardianRelationship: 'Father',
      guardianMobile: '+260 95 987 6543',
      emergencyName: 'MUMBA SENIOR GUARDIAN',
      emergencyMobile: '+260 95 987 6543',
      feesPaidBy: 'CDF Sponsorship',
      sponsorName: 'Chisamba Constituency Development Fund',
      status: 'Admitted / Accepted'
    };

    const pdfBuffer = await generateEnrollmentFormPdf(sampleData, offsets);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Enrollment_Form_Preview.pdf"',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return fail(e);
  }
}
