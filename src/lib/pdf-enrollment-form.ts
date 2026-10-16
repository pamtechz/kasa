import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';

function ascii(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).replace(/[^\x20-\x7e\n]/g, ' ');
}

function wrap(text: string, size: number, maxWidth: number, font: {widthOfTextAtSize(t: string, n: number): number}) {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const test = line ? line + ' ' + word : word;
      if (line && font.widthOfTextAtSize(test, size) > maxWidth) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}

export type EnrollmentFormData = {
  reference: string;
  applicationDate: string;
  intakeAndYear: string;
  programmeTitle: string;
  trainingArea?: string;
  shortCourseSpecify?: string;
  sportsFocus?: string;
  agricultureInterests?: string[];
  preferredIntake?: string;
  fullNames: string;
  dob?: string;
  gender?: string;
  nationality?: string;
  nrcNumber?: string;
  mobileNumber?: string;
  whatsappNumber?: string;
  email?: string;
  residentialAddress?: string;
  district?: string;
  province?: string;
  postalAddress?: string;
  highestGrade?: string;
  schoolInstitution?: string;
  qualificationYear?: string;
  currentStatus?: string;
  occupation?: string;
  previousExperience?: string;
  guardianName?: string;
  guardianRelationship?: string;
  guardianMobile?: string;
  guardianAddress?: string;
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyMobile?: string;
  learningSupport?: string;
  healthNeeds?: string;
  healthDetails?: string;
  feesPaidBy?: string;
  sponsorName?: string;
  sponsorPhone?: string;
  supportingDocuments?: string[];
  photoPublicityConsent?: boolean;
  status?: string;
  agreedFees?: string;
};

export async function generateEnrollmentFormPdf(data: EnrollmentFormData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const darkInk = rgb(0.1, 0.16, 0.13);
  const mutedText = rgb(0.38, 0.46, 0.42);
  const lineCol = rgb(0.7, 0.74, 0.72);

  function drawFooter(page: any, pageNum: number) {
    page.drawLine({start: {x: 35, y: 35}, end: {x: 560, y: 35}, thickness: 0.5, color: lineCol});
    page.drawText(`KASA  |  Contact +260 574 203 660  |  kasa@zamfirm.com  |  Page ${pageNum} of 3`, {
      x: 35, y: 22, size: 8, font: regular, color: mutedText
    });
  }

  // ==========================================
  // PAGE 1: 1 PROGRAMME SELECTION, 2 APPLICANT DETAILS, 3 EDUCATION
  // ==========================================
  const page1 = pdf.addPage([595, 842]);
  let y = 805;

  // Header Title
  page1.drawText('KAMAILA ACADEMICS', {x: 230, y, size: 11, font: bold, color: darkInk}); y -= 14;
  page1.drawText('SPORTS AND APPRENTICESHIP(KASA)', {x: 185, y, size: 11, font: bold, color: darkInk}); y -= 13;
  page1.drawText('House No. 40, Civic Centre, Area 22, Lusaka', {x: 205, y, size: 8.5, font: regular, color: mutedText}); y -= 18;
  page1.drawText('KASA Enrollment Form', {x: 225, y, size: 13, font: bold, color: darkInk}); y -= 14;

  const intro = 'Complete in BLOCK CAPITALS and tick the appropriate boxes. Use N/A where a field does not apply. Submit this form to KASA for review and confirmation of your enrollment.';
  for (const l of wrap(intro, 8, 520, italic)) {
    page1.drawText(l, {x: 35, y, size: 8, font: italic, color: mutedText}); y -= 11;
  }
  y -= 4;

  page1.drawText(`Application date (DD/MM/YYYY): ${ascii(data.applicationDate || '16/10/2026')}`, {x: 35, y, size: 8.5, font: bold, color: darkInk});
  page1.drawText(`Intake and year: ${ascii(data.intakeAndYear || '2027 Intake')}`, {x: 320, y, size: 8.5, font: bold, color: darkInk});
  y -= 18;

  // 1 PROGRAMME SELECTION
  page1.drawText('1 PROGRAMME SELECTION', {x: 35, y, size: 10, font: bold, color: darkInk}); y -= 15;
  page1.drawText(`Programme or course title: ${ascii(data.programmeTitle)}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 15;

  const isAgri = !data.trainingArea || data.trainingArea.toLowerCase().includes('agri');
  const isSport = data.trainingArea?.toLowerCase().includes('sport');
  const isCoop = data.trainingArea?.toLowerCase().includes('coop');
  page1.drawText(`Training area:  ${isAgri ? '[X]' : '[ ]'} General Agriculture   ${isSport ? '[X]' : '[ ]'} Sports   ${isCoop ? '[X]' : '[ ]'} Cooperative Development`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 14;

  const isShort = data.programmeTitle.toLowerCase().includes('short');
  page1.drawText(`${isShort ? '[X]' : '[ ]'} Short Course Please specify: ${ascii(data.shortCourseSpecify || (isShort ? data.programmeTitle : 'N/A'))}`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 14;

  page1.drawText('Sports focus if applicable: [ ] Football coaching  [ ] Athletics coaching  [ ] Both  [ ] Sports/Athletics Personnel', {
    x: 35, y, size: 8, font: regular, color: mutedText
  });
  y -= 14;

  page1.drawText('Agriculture interests if applicable:', {x: 35, y, size: 8.5, font: bold, color: darkInk}); y -= 12;
  page1.drawText('[X] Crop production   [X] Horticulture   [X] Irrigation   [X] Poultry   [X] Livestock', {
    x: 45, y, size: 8, font: regular, color: darkInk
  });
  y -= 12;
  page1.drawText('[X] Fish farming   [X] Pasture and feed production   [ ] Other: __________________________', {
    x: 45, y, size: 8, font: regular, color: darkInk
  });
  y -= 14;

  page1.drawText(`Preferred intake:  ${data.intakeAndYear?.toLowerCase().includes('jan') ? '[X]' : '[ ]'} January   ${data.intakeAndYear?.toLowerCase().includes('jul') ? '[X]' : '[ ]'} July`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 20;

  // 2 APPLICANT DETAILS
  page1.drawText('2 APPLICANT DETAILS', {x: 35, y, size: 10, font: bold, color: darkInk}); y -= 15;
  page1.drawText(`Full names: ${ascii(data.fullNames)}`, {x: 35, y, size: 8.5, font: bold, color: darkInk}); y -= 14;

  const isMale = data.gender?.toLowerCase() === 'male';
  const isFemale = data.gender?.toLowerCase() === 'female';
  page1.drawText(`Date of birth (DD/MM/YYYY): ${ascii(data.dob || '—')}    Gender:  ${isMale ? '[X]' : '[ ]'} Male   ${isFemale ? '[X]' : '[ ]'} Female`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 14;

  page1.drawText(`Nationality: ${ascii(data.nationality || 'Zambian')}    NRC or passport number if available: ${ascii(data.nrcNumber || 'On file')}`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 14;

  page1.drawText(`Mobile number: ${ascii(data.mobileNumber || '—')}    WhatsApp number: ${ascii(data.whatsappNumber || data.mobileNumber || '—')}`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 14;

  page1.drawText(`Email address if available: ${ascii(data.email || '—')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 14;
  page1.drawText(`Residential address or village: ${ascii(data.residentialAddress || 'Kamaila / Chisamba')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 14;
  page1.drawText(`District: ${ascii(data.district || 'Chisamba')}    Province: ${ascii(data.province || 'Central Province')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 14;
  page1.drawText(`Postal address if different: ${ascii(data.postalAddress || 'P.O. Box 40, Chisamba')}`, {x: 35, y, size: 8.5, font: regular, color: mutedText}); y -= 20;

  // 3 EDUCATION AND PRACTICAL EXPERIENCE
  page1.drawText('3 EDUCATION AND PRACTICAL EXPERIENCE', {x: 35, y, size: 10, font: bold, color: darkInk}); y -= 15;
  page1.drawText(`Highest grade or qualification completed: ${ascii(data.highestGrade || 'Grade 12')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 14;
  page1.drawText(`School or training institution: ${ascii(data.schoolInstitution || 'Secondary School')}    Year: ${ascii(data.qualificationYear || '2025')}`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });

  drawFooter(page1, 1);

  // ==========================================
  // PAGE 2: CONTINUED 3, 4, 5, 6, 7
  // ==========================================
  const page2 = pdf.addPage([595, 842]);
  y = 805;
  page2.drawText('KASA Enrollment Form', {x: 35, y, size: 10, font: bold, color: mutedText}); y -= 20;

  page2.drawText(`Current status:  ${data.currentStatus === 'Student' ? '[X]' : '[ ]'} Student   ${data.currentStatus === 'Employed' ? '[X]' : '[ ]'} Employed   ${data.currentStatus === 'Self employed' ? '[X]' : '[ ]'} Self employed   ${data.currentStatus === 'Seeking work' || !data.currentStatus ? '[X]' : '[ ]'} Seeking work`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 15;
  page2.drawText(`Occupation (optional): ${ascii(data.occupation || 'N/A')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 15;
  page2.drawText(`Previous training or experience related to this course: ${ascii(data.previousExperience || 'Family farming and community agriculture.')}`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 24;

  // 4 PARENT OR GUARDIAN AND EMERGENCY CONTACT
  page2.drawText('4 PARENT OR GUARDIAN AND EMERGENCY CONTACT', {x: 35, y, size: 10, font: bold, color: darkInk}); y -= 14;
  page2.drawText('PARENT OR GUARDIAN  (Complete for applicants under 18, or where a guardian is involved in enrollment)', {
    x: 35, y, size: 8, font: italic, color: mutedText
  });
  y -= 14;
  page2.drawText(`Full name: ${ascii(data.guardianName || 'Mwape Senior')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 13;
  page2.drawText(`Relationship to applicant: ${ascii(data.guardianRelationship || 'Parent')}    Mobile number: ${ascii(data.guardianMobile || '+260 97X XXX XXX')}`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 13;
  page2.drawText(`Residential address: ${ascii(data.guardianAddress || data.residentialAddress || 'Same as applicant')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 18;

  page2.drawText('EMERGENCY CONTACT  (For every applicant. If the guardian is also the emergency contact, tick here [X])', {
    x: 35, y, size: 8, font: italic, color: mutedText
  });
  y -= 14;
  page2.drawText(`Full name: ${ascii(data.emergencyName || data.guardianName || 'Emergency Contact')}    Relationship: ${ascii(data.emergencyRelationship || 'Parent')}`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 13;
  page2.drawText(`Mobile number: ${ascii(data.emergencyMobile || data.guardianMobile || '+260 97X XXX XXX')}`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 24;

  // 5 LEARNING AND PRACTICAL TRAINING SUPPORT
  page2.drawText('5 LEARNING AND PRACTICAL TRAINING SUPPORT', {x: 35, y, size: 10, font: bold, color: darkInk}); y -= 14;
  page2.drawText('Do you need learning or access support?  [ ] Yes   [X] No   [ ] Discuss privately', {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 14;
  page2.drawText(`Support or adjustments needed: ${ascii(data.learningSupport || 'None')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 14;
  page2.drawText(`Health needs affecting participation:  [X] None to report   [ ] Details below   [ ] Discuss privately`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 14;
  page2.drawText(`Relevant condition allergies or emergency instructions: ${ascii(data.healthDetails || 'None')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 24;

  // 6 FUNDING ARRANGEMENTS
  page2.drawText('6 FUNDING ARRANGEMENTS', {x: 35, y, size: 10, font: bold, color: darkInk}); y -= 14;
  const isCdf = data.feesPaidBy?.toLowerCase().includes('cdf');
  const isSelf = data.feesPaidBy?.toLowerCase().includes('self');
  const isParent = data.feesPaidBy?.toLowerCase().includes('parent');
  page2.drawText(`Fees paid by:  ${isSelf ? '[X]' : '[ ]'} Self   ${isParent ? '[X]' : '[ ]'} Parent or guardian   [ ] Employer   [ ] Sponsor   ${isCdf ? '[X]' : '[ ]'} CDF`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 14;
  page2.drawText(`Payer or sponsor name: ${ascii(data.sponsorName || (isCdf ? 'Constituency Development Fund (CDF)' : data.fullNames))}    Phone: ${ascii(data.sponsorPhone || data.mobileNumber || '—')}`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 24;

  // 7 SUPPORTING DOCUMENTS
  page2.drawText('7 SUPPORTING DOCUMENTS', {x: 35, y, size: 10, font: bold, color: darkInk}); y -= 14;
  page2.drawText('Tick documents submitted where applicable. KASA will confirm which documents your chosen programme requires.', {
    x: 35, y, size: 8, font: italic, color: mutedText
  });
  y -= 14;
  page2.drawText('[X] NRC/Passport    [X] School results or qualification    [X] Photograph if requested', {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 14;
  page2.drawText(`${isCdf ? '[X]' : '[ ]'} Sponsorship letter (CDF / Bursary)    [ ] Other: ___________________________________`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });

  drawFooter(page2, 2);

  // ==========================================
  // PAGE 3: 8 DECLARATION AND CONSENT, 9 FOR OFFICE USE ONLY
  // ==========================================
  const page3 = pdf.addPage([595, 842]);
  y = 805;
  page3.drawText('KASA Enrollment Form', {x: 35, y, size: 10, font: bold, color: mutedText}); y -= 20;

  page3.drawText('8 DECLARATION AND CONSENT', {x: 35, y, size: 10, font: bold, color: darkInk}); y -= 14;
  const dec1 = `I, ${ascii(data.fullNames)}, confirm that the information provided is accurate to the best of my knowledge. If admitted, I will follow the attendance requirements, conduct rules and safety instructions explained by KASA. I will use required protective equipment and report unsafe conditions.`;
  for (const l of wrap(dec1, 8.5, 520, regular)) {
    page3.drawText(l, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 12;
  }
  y -= 4;

  const dec2 = 'I understand that the programme requirements, timetable, fees, payment terms, cancellation and refund terms, and any assessment or certification arrangements must be explained before I confirm enrollment.';
  for (const l of wrap(dec2, 8.5, 520, regular)) {
    page3.drawText(l, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 12;
  }
  y -= 8;

  page3.drawText('OPTIONAL PHOTOGRAPHS AND PUBLICITY', {x: 35, y, size: 8.5, font: bold, color: darkInk}); y -= 12;
  page3.drawText('I agree to KASA using photographs or videos that identify me in its publicity. Choosing No does not affect enrollment.', {
    x: 35, y, size: 8, font: regular, color: mutedText
  });
  y -= 12;
  page3.drawText('[X] Yes    [ ] No', {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 16;

  page3.drawText(`Applicant signature / thumbprint: ______________________________    Date: ${ascii(data.applicationDate || '16/10/2026')}`, {
    x: 35, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 22;

  page3.drawText('PARENT OR GUARDIAN APPROVAL FOR APPLICANTS UNDER 18', {x: 35, y, size: 8.5, font: bold, color: darkInk}); y -= 12;
  page3.drawText('I parent/guardian consent to the applicant enrolling in the selected programme and taking part in its supervised training activities.', {
    x: 35, y, size: 8, font: italic, color: mutedText
  });
  y -= 14;
  page3.drawText('Guardian name: ________________________   Signature / thumbprint: _________________   Date: ___________', {
    x: 35, y, size: 8, font: regular, color: darkInk
  });
  y -= 28;

  // 9 FOR OFFICE USE ONLY
  page3.drawRectangle({x: 33, y: y - 245, width: 529, height: 250, color: rgb(0.97, 0.98, 0.97), borderColor: lineCol, borderWidth: 1});
  page3.drawText('9 FOR OFFICE USE ONLY', {x: 40, y: y - 14, size: 10, font: bold, color: rgb(0.7, 0.2, 0.2)}); y -= 28;

  page3.drawText(`Received by: Admissions Office              Date: ${ascii(data.applicationDate || '16/10/2026')}              Reference: ${ascii(data.reference)}`, {
    x: 40, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 16;
  page3.drawText(`Decision:  [X] Admitted   [ ] Pending   [ ] Waiting list   [ ] Not admitted`, {
    x: 40, y, size: 8.5, font: bold, color: rgb(0.06, 0.4, 0.2)
  });
  y -= 16;
  page3.drawText(`Enrollment number: ${ascii(data.reference)}        Confirmed programme: ${ascii(data.programmeTitle)}`, {
    x: 40, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 16;
  page3.drawText(`Intake or start date: ${ascii(data.intakeAndYear || 'January 2027')}        Programme duration: As specified in catalogue`, {
    x: 40, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 16;
  page3.drawText(`Fee currency: ZMW     Agreed total: ${ascii(data.agreedFees || 'Approved tariff')}     Status: Enrolled / Accepted`, {
    x: 40, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 18;

  page3.drawText('[X] Required documents checked         [X] Programme and fee terms explained', {
    x: 40, y, size: 8, font: regular, color: darkInk
  });
  y -= 14;
  page3.drawText('[X] Rules and safety explained         [X] Support arrangements reviewed where needed', {
    x: 40, y, size: 8, font: regular, color: darkInk
  });
  y -= 18;
  page3.drawText('Conditions or support arrangements: None. Ready for campus commencement.', {x: 40, y, size: 8, font: italic, color: mutedText}); y -= 24;

  page3.drawText('Authorised officer: Admissions Registrar      Signature: __________________________      Date: 16/10/2026', {
    x: 40, y, size: 8.5, font: bold, color: darkInk
  });

  drawFooter(page3, 3);

  return await pdf.save();
}
