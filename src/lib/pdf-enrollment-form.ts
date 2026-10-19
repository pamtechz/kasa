import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';
import fs from 'fs';
import path from 'path';

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

export async function generateEnrollmentFormPdf(data: EnrollmentFormData, customOffsets?: Record<string, {x: number; y: number; fontSize?: number}>): Promise<Uint8Array> {
  const defaults: Record<string, {x: number; y: number; fontSize: number}> = {
    applicationDate: {x: 165, y: 736, fontSize: 9},
    intakeAndYear: {x: 410, y: 736, fontSize: 9},
    programmeTitle: {x: 175, y: 698, fontSize: 9},
    fullNames: {x: 105, y: 550, fontSize: 9},
    dob: {x: 175, y: 536, fontSize: 9},
    gender: {x: 330, y: 536, fontSize: 9},
    nationality: {x: 105, y: 522, fontSize: 9},
    nrcNumber: {x: 380, y: 522, fontSize: 9},
    mobileNumber: {x: 125, y: 508, fontSize: 9},
    whatsappNumber: {x: 350, y: 508, fontSize: 9},
    email: {x: 175, y: 494, fontSize: 9},
    residentialAddress: {x: 195, y: 480, fontSize: 9},
    district: {x: 85, y: 466, fontSize: 9},
    province: {x: 300, y: 466, fontSize: 9},
    highestGrade: {x: 230, y: 395, fontSize: 9},
    schoolInstitution: {x: 190, y: 381, fontSize: 9},
    qualificationYear: {x: 480, y: 381, fontSize: 9},
    occupation: {x: 160, y: 760, fontSize: 9},
    guardianName: {x: 105, y: 685, fontSize: 9},
    guardianRelationship: {x: 165, y: 672, fontSize: 9},
    guardianMobile: {x: 420, y: 672, fontSize: 9},
    emergencyName: {x: 105, y: 615, fontSize: 9},
    emergencyMobile: {x: 125, y: 602, fontSize: 9},
    sponsorName: {x: 165, y: 446, fontSize: 9},
    declarationName: {x: 175, y: 690, fontSize: 9},
    declarationDate: {x: 440, y: 690, fontSize: 9},
    officeReference: {x: 440, y: 510, fontSize: 9},
    officeEnrollmentNum: {x: 155, y: 478, fontSize: 9},
    officeConfirmedProg: {x: 380, y: 478, fontSize: 9},
    officeIntakeDate: {x: 155, y: 462, fontSize: 9}
  };

  function getPos(key: string) {
    const o = customOffsets?.[key] || defaults[key] || {x: 100, y: 500, fontSize: 9};
    return {x: Number(o.x), y: Number(o.y), fontSize: Number(o.fontSize || 9)};
  }

  let templateBuffer: Buffer | null = null;
  try {
    const tPath = path.join(process.cwd(), 'public', 'templates', 'official-enrollment-form-template.pdf');
    if (fs.existsSync(tPath)) {
      templateBuffer = fs.readFileSync(tPath);
    }
  } catch {}

  if (templateBuffer) {
    try {
      const pdf = await PDFDocument.load(templateBuffer);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const regular = await pdf.embedFont(StandardFonts.Helvetica);
      const blueInk = rgb(0.05, 0.25, 0.55);

      const pages = pdf.getPages();
      const p1 = pages[0];
      const p2 = pages[1];
      const p3 = pages[2];

      if (p1) {
        // Application Date & Intake
        const posAppDate = getPos('applicationDate');
        const posIntake = getPos('intakeAndYear');
        p1.drawText(ascii(data.applicationDate || new Date().toLocaleDateString('en-GB')), { x: posAppDate.x, y: posAppDate.y, size: posAppDate.fontSize, font: bold, color: blueInk });
        p1.drawText(ascii(data.intakeAndYear || '2027 Intake'), { x: posIntake.x, y: posIntake.y, size: posIntake.fontSize, font: bold, color: blueInk });

        // Programme title & applicant details
        const posProg = getPos('programmeTitle');
        const posName = getPos('fullNames');
        const posDob = getPos('dob');
        const posGender = getPos('gender');
        const posNat = getPos('nationality');
        const posNrc = getPos('nrcNumber');
        const posMob = getPos('mobileNumber');
        const posWa = getPos('whatsappNumber');
        const posMail = getPos('email');
        const posAddr = getPos('residentialAddress');
        const posDist = getPos('district');
        const posProv = getPos('province');

        p1.drawText(ascii(data.programmeTitle), { x: posProg.x, y: posProg.y, size: posProg.fontSize, font: bold, color: blueInk });
        p1.drawText(ascii(data.fullNames), { x: posName.x, y: posName.y, size: posName.fontSize, font: bold, color: blueInk });
        p1.drawText(ascii(data.dob || '—'), { x: posDob.x, y: posDob.y, size: posDob.fontSize, font: regular, color: blueInk });
        p1.drawText(ascii(data.gender || '—'), { x: posGender.x, y: posGender.y, size: posGender.fontSize, font: regular, color: blueInk });
        p1.drawText(ascii(data.nationality || 'Zambian'), { x: posNat.x, y: posNat.y, size: posNat.fontSize, font: regular, color: blueInk });
        p1.drawText(ascii(data.nrcNumber || 'On file'), { x: posNrc.x, y: posNrc.y, size: posNrc.fontSize, font: regular, color: blueInk });
        p1.drawText(ascii(data.mobileNumber || '—'), { x: posMob.x, y: posMob.y, size: posMob.fontSize, font: regular, color: blueInk });
        p1.drawText(ascii(data.whatsappNumber || data.mobileNumber || '—'), { x: posWa.x, y: posWa.y, size: posWa.fontSize, font: regular, color: blueInk });
        p1.drawText(ascii(data.email || '—'), { x: posMail.x, y: posMail.y, size: posMail.fontSize, font: regular, color: blueInk });
        p1.drawText(ascii(data.residentialAddress || '—'), { x: posAddr.x, y: posAddr.y, size: posAddr.fontSize, font: regular, color: blueInk });
        p1.drawText(ascii(data.district || '—'), { x: posDist.x, y: posDist.y, size: posDist.fontSize, font: regular, color: blueInk });
        p1.drawText(ascii(data.province || '—'), { x: posProv.x, y: posProv.y, size: posProv.fontSize, font: regular, color: blueInk });

        const posGrade = getPos('highestGrade');
        const posSchool = getPos('schoolInstitution');
        const posYear = getPos('qualificationYear');
        p1.drawText(ascii(data.highestGrade || 'Grade 12'), { x: posGrade.x, y: posGrade.y, size: posGrade.fontSize, font: regular, color: blueInk });
        p1.drawText(ascii(data.schoolInstitution || 'Secondary School'), { x: posSchool.x, y: posSchool.y, size: posSchool.fontSize, font: regular, color: blueInk });
        p1.drawText(ascii(data.qualificationYear || '2025'), { x: posYear.x, y: posYear.y, size: posYear.fontSize, font: regular, color: blueInk });
      }

      if (p2) {
        const posOcc = getPos('occupation');
        const posGName = getPos('guardianName');
        const posGRel = getPos('guardianRelationship');
        const posGMob = getPos('guardianMobile');
        const posEName = getPos('emergencyName');
        const posEMob = getPos('emergencyMobile');
        const posSponsor = getPos('sponsorName');

        p2.drawText(ascii(data.occupation || 'N/A'), { x: posOcc.x, y: posOcc.y, size: posOcc.fontSize, font: regular, color: blueInk });
        p2.drawText(ascii(data.guardianName || 'Mwape Senior'), { x: posGName.x, y: posGName.y, size: posGName.fontSize, font: bold, color: blueInk });
        p2.drawText(ascii(data.guardianRelationship || 'Parent'), { x: posGRel.x, y: posGRel.y, size: posGRel.fontSize, font: regular, color: blueInk });
        p2.drawText(ascii(data.guardianMobile || '—'), { x: posGMob.x, y: posGMob.y, size: posGMob.fontSize, font: regular, color: blueInk });
        p2.drawText(ascii(data.emergencyName || data.guardianName || 'Emergency Contact'), { x: posEName.x, y: posEName.y, size: posEName.fontSize, font: regular, color: blueInk });
        p2.drawText(ascii(data.emergencyMobile || data.guardianMobile || '—'), { x: posEMob.x, y: posEMob.y, size: posEMob.fontSize, font: regular, color: blueInk });
        p2.drawText(ascii(data.sponsorName || (data.feesPaidBy?.toLowerCase().includes('cdf') ? 'Constituency Development Fund (CDF)' : data.fullNames)), { x: posSponsor.x, y: posSponsor.y, size: posSponsor.fontSize, font: regular, color: blueInk });
      }

      if (p3) {
        const posDecName = getPos('declarationName');
        const posDecDate = getPos('declarationDate');
        const posOffRef = getPos('officeReference');
        const posOffNum = getPos('officeEnrollmentNum');
        const posOffProg = getPos('officeConfirmedProg');
        const posOffDate = getPos('officeIntakeDate');

        p3.drawText(ascii(data.fullNames), { x: posDecName.x, y: posDecName.y, size: posDecName.fontSize, font: bold, color: blueInk });
        p3.drawText(ascii(data.applicationDate || new Date().toLocaleDateString('en-GB')), { x: posDecDate.x, y: posDecDate.y, size: posDecDate.fontSize, font: bold, color: blueInk });
        p3.drawText(ascii(data.reference), { x: posOffRef.x, y: posOffRef.y, size: posOffRef.fontSize, font: bold, color: blueInk });
        p3.drawText(ascii(data.reference), { x: posOffNum.x, y: posOffNum.y, size: posOffNum.fontSize, font: bold, color: blueInk });
        p3.drawText(ascii(data.programmeTitle), { x: posOffProg.x, y: posOffProg.y, size: posOffProg.fontSize, font: bold, color: blueInk });
        p3.drawText(ascii(data.intakeAndYear || 'January 2027'), { x: posOffDate.x, y: posOffDate.y, size: posOffDate.fontSize, font: regular, color: blueInk });
      }

      return await pdf.save();
    } catch {
      // Fall through to dynamic fallback if template parsing fails
    }
  }

  // Dynamic fallback PDF document creation
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

  const page1 = pdf.addPage([595, 842]);
  let y = 805;

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

  page1.drawText('1 PROGRAMME SELECTION', {x: 35, y, size: 10, font: bold, color: darkInk}); y -= 15;
  page1.drawText(`Programme or course title: ${ascii(data.programmeTitle)}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 15;

  page1.drawText(`Full names: ${ascii(data.fullNames)}`, {x: 35, y, size: 8.5, font: bold, color: darkInk}); y -= 14;
  page1.drawText(`Nationality: ${ascii(data.nationality || 'Zambian')}    NRC: ${ascii(data.nrcNumber || 'On file')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 14;
  page1.drawText(`Mobile: ${ascii(data.mobileNumber || '—')}    Email: ${ascii(data.email || '—')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 14;

  drawFooter(page1, 1);

  const page2 = pdf.addPage([595, 842]);
  y = 805;
  page2.drawText('KASA Enrollment Form (Page 2)', {x: 35, y, size: 10, font: bold, color: mutedText}); y -= 20;
  page2.drawText(`Guardian: ${ascii(data.guardianName || 'Mwape Senior')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 14;
  page2.drawText(`Fees paid by: ${ascii(data.feesPaidBy || 'CDF / Self-Funded')}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 14;
  drawFooter(page2, 2);

  const page3 = pdf.addPage([595, 842]);
  y = 805;
  page3.drawText('KASA Enrollment Form (Page 3)', {x: 35, y, size: 10, font: bold, color: mutedText}); y -= 20;
  page3.drawText(`Reference: ${ascii(data.reference)}`, {x: 35, y, size: 10, font: bold, color: darkInk}); y -= 14;
  page3.drawText(`Applicant signature: ${ascii(data.fullNames)}`, {x: 35, y, size: 8.5, font: regular, color: darkInk}); y -= 14;
  drawFooter(page3, 3);

  return await pdf.save();
}
