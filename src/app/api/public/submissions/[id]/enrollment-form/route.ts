import {authorizeSubmissionDocument} from '@/lib/submission-access';
import {db} from '@/lib/firebase-admin';
import {fail, HttpError} from '@/lib/errors';
import {generateEnrollmentFormPdf, type EnrollmentFormData} from '@/lib/pdf-enrollment-form';

export const runtime = 'nodejs';

export async function GET(req: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const {id} = await params;
    const snap = await db.collection('submissions').doc(id).get();
    if (!snap.exists) throw new HttpError(404, 'Application not found.');
    const data = snap.data()!;
    await authorizeSubmissionDocument(req,data);

    // Preserve administrator-configured enrollment PDF field positions.
    const letterSettingsDoc = await db.collection('settings').doc('acceptanceLetter').get();
    const offsets = letterSettingsDoc.data()?.enrollmentFormOffsets || {};
    const answers = data.answers || {};

    const fullNames = String(
      answers['full-name'] || answers['student-name'] || answers['fullNames'] || 'Applicant'
    );
    const programmeTitle = String(
      answers['programme-pathway'] || answers['program'] || answers['programmeTitle'] || data.formTitle || 'General Agriculture'
    );
    const intakeAndYear = String(
      answers['intake'] || answers['intakeAndYear'] || ''
    );
    const applicationDate = new Date(data.submittedAt || Date.now()).toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const formData: EnrollmentFormData = {
      reference: data.reference,
      applicationDate,
      intakeAndYear,
      programmeTitle,
      trainingArea: String(answers['trainingArea'] || answers['training-area'] || programmeTitle),
      shortCourseSpecify: String(answers['shortCourseSpecify'] || answers['short-course'] || ''),
      sportsFocus: String(answers['sportsFocus'] || answers['sports-focus'] || ''),
      preferredIntake: intakeAndYear,
      fullNames,
      dob: String(answers['date-of-birth'] || answers['dob'] || ''),
      gender: String(answers['gender'] || ''),
      nationality: String(answers['nationality'] || ''),
      nrcNumber: String(answers['nrc-number'] || answers['nrcNumber'] || ''),
      mobileNumber: String(answers['phone'] || answers['mobileNumber'] || ''),
      whatsappNumber: String(answers['whatsappNumber'] || answers['phone'] || ''),
      email: String(answers['email'] || ''),
      residentialAddress: String(answers['residentialAddress'] || answers['residential-address'] || answers['ward'] || ''),
      district: String(answers['district'] || ''),
      province: String(answers['province'] || ''),
      postalAddress: String(answers['postalAddress'] || ''),
      highestGrade: String(answers['education-level'] || answers['highest-education'] || answers['highestGrade'] || ''),
      schoolInstitution: String(answers['schoolInstitution'] || ''),
      qualificationYear: String(answers['qualificationYear'] || ''),
      currentStatus: String(answers['currentStatus'] || ''),
      occupation: String(answers['occupation'] || ''),
      previousExperience: String(answers['previousExperience'] || ''),
      guardianName: String(answers['guardianName'] || ''),
      guardianRelationship: String(answers['guardianRelationship'] || ''),
      guardianMobile: String(answers['guardianMobile'] || ''),
      guardianAddress: String(answers['guardianAddress'] || ''),
      emergencyName: String(answers['emergencyName'] || ''),
      emergencyRelationship: String(answers['emergencyRelationship'] || ''),
      emergencyMobile: String(answers['emergencyMobile'] || ''),
      learningSupport: String(answers['learningSupport'] || answers['learning-support'] || ''),
      healthNeeds: String(answers['medical-conditions'] || answers['medical-note'] || ''),
      healthDetails: String(answers['medical-conditions'] || answers['medical-note'] || ''),
      feesPaidBy: String(answers['funding-pathway'] || answers['funding-arrangements'] || answers['fees-paid-by'] || (data.fundingMethod === 'cdf' ? 'CDF' : 'Self')),
      sponsorName: String(answers['sponsorName'] || ''),
      sponsorPhone: String(answers['sponsorPhone'] || ''),
      photoPublicityConsent: ['yes','true','1'].includes(String(answers['photo-publicity-consent'] || answers['photoPublicityConsent'] || '').toLowerCase()),
      status: data.status,
      agreedFees: String(answers['agreedFees'] || '')
    };

    const bytes = await generateEnrollmentFormPdf(formData, offsets);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="KASA-Enrollment-Form-${data.reference}.pdf"`,
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (e) {
    return fail(e);
  }
}
