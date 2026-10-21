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

    const answers = data.answers || {};

    const fullNames = String(
      answers['full-name'] || answers['student-name'] || answers['fullNames'] || 'Applicant'
    );
    const programmeTitle = String(
      answers['programme-pathway'] || answers['program'] || answers['programmeTitle'] || data.formTitle || 'General Agriculture'
    );
    const intakeAndYear = String(
      answers['intake'] || answers['intakeAndYear'] || '2027 January Intake'
    );
    const applicationDate = new Date(data.submittedAt || Date.now()).toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const formData: EnrollmentFormData = {
      reference: data.reference,
      applicationDate,
      intakeAndYear,
      programmeTitle,
      trainingArea: String(answers['trainingArea'] || answers['training-area'] || 'General Agriculture'),
      shortCourseSpecify: String(answers['shortCourseSpecify'] || answers['short-course'] || ''),
      sportsFocus: String(answers['sportsFocus'] || answers['sports-focus'] || ''),
      preferredIntake: intakeAndYear,
      fullNames,
      dob: String(answers['date-of-birth'] || answers['dob'] || '2004-05-14'),
      gender: String(answers['gender'] || 'Male'),
      nationality: String(answers['nationality'] || 'Zambian'),
      nrcNumber: String(answers['nrc-number'] || answers['nrcNumber'] || 'On file'),
      mobileNumber: String(answers['phone'] || answers['mobileNumber'] || '+260 97X XXX XXX'),
      whatsappNumber: String(answers['whatsappNumber'] || answers['phone'] || '+260 97X XXX XXX'),
      email: String(answers['email'] || 'applicant@example.com'),
      residentialAddress: String(answers['residentialAddress'] || answers['residential-address'] || answers['ward'] || 'Kamaila Farming Block'),
      district: String(answers['district'] || 'Chisamba'),
      province: String(answers['province'] || 'Central Province'),
      postalAddress: String(answers['postalAddress'] || 'P.O. Box 40, Chisamba'),
      highestGrade: String(answers['education-level'] || answers['highest-education'] || answers['highestGrade'] || 'Grade 12'),
      schoolInstitution: String(answers['schoolInstitution'] || 'Secondary School'),
      qualificationYear: String(answers['qualificationYear'] || '2025'),
      currentStatus: String(answers['currentStatus'] || 'Student'),
      occupation: String(answers['occupation'] || 'N/A'),
      previousExperience: String(answers['previousExperience'] || 'Practical farming interests'),
      guardianName: String(answers['guardianName'] || 'Family Guardian'),
      guardianRelationship: String(answers['guardianRelationship'] || 'Parent'),
      guardianMobile: String(answers['guardianMobile'] || answers['phone'] || '+260 97X XXX XXX'),
      guardianAddress: String(answers['guardianAddress'] || answers['district'] || 'Chisamba'),
      emergencyName: String(answers['emergencyName'] || 'Emergency Contact'),
      emergencyRelationship: String(answers['emergencyRelationship'] || 'Parent'),
      emergencyMobile: String(answers['emergencyMobile'] || answers['phone'] || '+260 97X XXX XXX'),
      learningSupport: 'None',
      healthNeeds: String(answers['medical-conditions'] || answers['medical-note'] || 'None to report'),
      healthDetails: String(answers['medical-conditions'] || answers['medical-note'] || 'None'),
      feesPaidBy: String(answers['funding-pathway'] || answers['funding-arrangements'] || answers['fees-paid-by'] || (data.fundingMethod === 'cdf' ? 'CDF' : 'Self')),
      sponsorName: data.fundingMethod === 'cdf' ? 'Constituency Development Fund (CDF)' : fullNames,
      sponsorPhone: String(answers['phone'] || '—'),
      photoPublicityConsent: true,
      status: data.status,
      agreedFees: 'Approved 2027 Tariff'
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
