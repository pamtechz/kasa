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

function drawFittedText(
  page: any,
  text: string | null | undefined,
  pos: {x: number; y: number; fontSize: number},
  maxWidth: number,
  font: any,
  color: any,
  maxLines = 1
) {
  const clean = ascii(text).trim();
  if (!clean) return;

  let size = pos.fontSize;
  let textWidth = font.widthOfTextAtSize(clean, size);

  if (textWidth <= maxWidth) {
    page.drawText(clean, { x: pos.x, y: pos.y, size, font, color });
    return;
  }

  while (size > 6.5) {
    size -= 0.5;
    if (font.widthOfTextAtSize(clean, size) <= maxWidth) {
      page.drawText(clean, { x: pos.x, y: pos.y, size, font, color });
      return;
    }
  }

  size = Math.max(size, 6.5);
  const lines = wrap(clean, size, maxWidth, font);
  let currentY = pos.y;
  for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
    page.drawText(lines[i], { x: pos.x, y: currentY, size, font, color });
    currentY -= (size + 1.5);
  }
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
        drawFittedText(p1, data.applicationDate || new Date().toLocaleDateString('en-GB'), getPos('applicationDate'), 120, bold, blueInk);
        drawFittedText(p1, data.intakeAndYear || '2027 Intake', getPos('intakeAndYear'), 120, bold, blueInk);

        // Programme title & applicant details
        drawFittedText(p1, data.programmeTitle, getPos('programmeTitle'), 360, bold, blueInk, 2);
        drawFittedText(p1, data.fullNames, getPos('fullNames'), 430, bold, blueInk);
        drawFittedText(p1, data.dob || '—', getPos('dob'), 110, regular, blueInk);
        drawFittedText(p1, data.gender || '—', getPos('gender'), 90, regular, blueInk);
        drawFittedText(p1, data.nationality || 'Zambian', getPos('nationality'), 180, regular, blueInk);
        drawFittedText(p1, data.nrcNumber || 'On file', getPos('nrcNumber'), 160, regular, blueInk);
        drawFittedText(p1, data.mobileNumber || '—', getPos('mobileNumber'), 170, regular, blueInk);
        drawFittedText(p1, data.whatsappNumber || data.mobileNumber || '—', getPos('whatsappNumber'), 170, regular, blueInk);
        drawFittedText(p1, data.email || '—', getPos('email'), 340, regular, blueInk);
        drawFittedText(p1, data.residentialAddress || '—', getPos('residentialAddress'), 330, regular, blueInk);
        drawFittedText(p1, data.district || '—', getPos('district'), 180, regular, blueInk);
        drawFittedText(p1, data.province || '—', getPos('province'), 220, regular, blueInk);

        drawFittedText(p1, data.highestGrade || 'Grade 12', getPos('highestGrade'), 260, regular, blueInk);
        drawFittedText(p1, data.schoolInstitution || 'Secondary School', getPos('schoolInstitution'), 250, regular, blueInk);
        drawFittedText(p1, data.qualificationYear || '2025', getPos('qualificationYear'), 80, regular, blueInk);
      }

      if (p2) {
        drawFittedText(p2, data.occupation || 'N/A', getPos('occupation'), 380, regular, blueInk);
        drawFittedText(p2, data.guardianName || 'Mwape Senior', getPos('guardianName'), 430, bold, blueInk);
        drawFittedText(p2, data.guardianRelationship || 'Parent', getPos('guardianRelationship'), 180, regular, blueInk);
        drawFittedText(p2, data.guardianMobile || '—', getPos('guardianMobile'), 130, regular, blueInk);
        drawFittedText(p2, data.emergencyName || data.guardianName || 'Emergency Contact', getPos('emergencyName'), 430, regular, blueInk);
        drawFittedText(p2, data.emergencyMobile || data.guardianMobile || '—', getPos('emergencyMobile'), 180, regular, blueInk);
        drawFittedText(p2, data.sponsorName || (data.feesPaidBy?.toLowerCase().includes('cdf') ? 'Constituency Development Fund (CDF)' : data.fullNames), getPos('sponsorName'), 370, regular, blueInk);
      }

      if (p3) {
        drawFittedText(p3, data.fullNames, getPos('declarationName'), 220, bold, blueInk);
        drawFittedText(p3, data.applicationDate || new Date().toLocaleDateString('en-GB'), getPos('declarationDate'), 110, bold, blueInk);
        drawFittedText(p3, data.reference, getPos('officeReference'), 120, bold, blueInk);
        drawFittedText(p3, data.reference, getPos('officeEnrollmentNum'), 180, bold, blueInk);
        drawFittedText(p3, data.programmeTitle, getPos('officeConfirmedProg'), 160, bold, blueInk, 2);
        drawFittedText(p3, data.intakeAndYear || 'January 2027', getPos('officeIntakeDate'), 180, regular, blueInk);
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
