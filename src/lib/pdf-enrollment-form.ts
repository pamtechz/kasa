import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

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

export async function generateEnrollmentFormPdf(
  data: EnrollmentFormData,
  _customOffsets?: Record<string, {x: number; y: number; fontSize?: number}>
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let logoImage: any = null;
  try {
    const logoBytes = await readFile(join(process.cwd(), 'public', 'kasa-headed-logo.jpg'));
    logoImage = await pdf.embedJpg(logoBytes);
  } catch {
    try {
      const logoBytes = await readFile(join(process.cwd(), 'public', 'kasa-logo-white.png'));
      logoImage = await pdf.embedPng(logoBytes);
    } catch {}
  }

  const green = rgb(0.055, 0.361, 0.212);
  const gold = rgb(0.773, 0.608, 0.153);
  const darkInk = rgb(0.1, 0.16, 0.13);
  const mutedText = rgb(0.38, 0.46, 0.42);
  const lightBg = rgb(0.96, 0.98, 0.96);
  const borderCol = rgb(0.82, 0.88, 0.84);

  // Common Header and Footer Banner across all 3 pages
  function drawFormHeader(page: any, pageNum: number) {
    // Top right accent polygons
    page.drawSvgPath('M 340 0 L 595 0 L 595 55 Z', { x: 0, y: 842, color: green });
    page.drawSvgPath('M 470 0 L 595 0 L 595 30 Z', { x: 0, y: 842, color: gold });

    // Logo
    if (logoImage) {
      page.drawImage(logoImage, { x: 38, y: 755, width: 62, height: 64 });
    }

    // Header Titles
    page.drawText('KAMAILA ACADEMICS, SPORTS & APPRENTICESHIP', {
      x: 110, y: 802, size: 11.5, font: bold, color: rgb(0.055, 0.29, 0.18)
    });
    page.drawText('(KASA) -- HEAD | HEART | HAND', {
      x: 110, y: 790, size: 8.5, font: bold, color: gold
    });
    page.drawText('House No. 40, Civic Centre, Area 22, Lusaka, Zambia', {
      x: 110, y: 778, size: 7.8, font: regular, color: rgb(0.29, 0.33, 0.40)
    });
    page.drawText('Contact: +260 574 203 660  |  Email: kasa@zamfirm.com  |  Web: kasaschool.vercel.app', {
      x: 110, y: 767, size: 7.8, font: regular, color: rgb(0.20, 0.25, 0.33)
    });

    // Page number in footer
    page.drawLine({ start: { x: 35, y: 35 }, end: { x: 560, y: 35 }, thickness: 0.8, color: borderCol });
    page.drawText(`KASA Official Enrollment Form  |  Ref: ${ascii(data.reference)}  |  Page ${pageNum} of 3`, {
      x: 35, y: 22, size: 8, font: regular, color: mutedText
    });
  }

  const drawSectionHeader = (page: any, yPos: number, title: string) => {
    page.drawRectangle({ x: 38, y: yPos - 2, width: 519, height: 16, color: green });
    page.drawText(ascii(title), { x: 44, y: yPos + 2, size: 9, font: bold, color: rgb(1, 1, 1) });
    return yPos - 20;
  };

  const drawKeyValueRow = (page: any, yPos: number, items: {label: string; value: string; width: number}[]) => {
    let xPos = 44;
    for (const item of items) {
      page.drawText(`${item.label}: `, { x: xPos, y: yPos, size: 8.2, font: bold, color: darkInk });
      const labelW = bold.widthOfTextAtSize(`${item.label}: `, 8.2);
      const valText = ascii(item.value || '—').trim();

      // Fit value text within allocated cell width
      let size = 8.2;
      while (size > 6.5 && regular.widthOfTextAtSize(valText, size) > item.width - labelW - 6) {
        size -= 0.5;
      }
      page.drawText(valText, { x: xPos + labelW, y: yPos, size, font: regular, color: darkInk });
      xPos += item.width;
    }
    return yPos - 15;
  };

  // ==========================================
  // PAGE 1: PERSONAL & PROGRAMME DETAILS
  // ==========================================
  const page1 = pdf.addPage([595, 842]);
  drawFormHeader(page1, 1);

  let y = 736;

  // Title Banner
  page1.drawRectangle({ x: 38, y: y - 2, width: 519, height: 22, color: lightBg, borderColor: borderCol, borderWidth: 1 });
  page1.drawText('OFFICIAL STUDENT ENROLLMENT FORM', { x: 180, y: y + 4, size: 11, font: bold, color: green });
  y -= 30;

  // Application Meta Box
  page1.drawRectangle({ x: 38, y: y - 22, width: 519, height: 26, color: rgb(0.98, 0.98, 0.98), borderColor: borderCol, borderWidth: 1 });
  page1.drawText(`Application Ref: ${ascii(data.reference)}`, { x: 46, y: y - 14, size: 9, font: bold, color: darkInk });
  page1.drawText(`Date: ${ascii(data.applicationDate || new Date().toLocaleDateString('en-GB'))}`, { x: 260, y: y - 14, size: 8.5, font: regular, color: darkInk });
  page1.drawText(`Intake: ${ascii(data.intakeAndYear || '2027 Intake')}`, { x: 420, y: y - 14, size: 8.5, font: bold, color: darkInk });
  y -= 36;

  // Section 1: Programme Selection
  y = drawSectionHeader(page1, y, '1. PROGRAMME & COURSE SELECTION');
  page1.drawRectangle({ x: 38, y: y - 32, width: 519, height: 42, color: lightBg, borderColor: borderCol, borderWidth: 1 });
  let py = y - 14;
  page1.drawText('Selected Programme / Course:', { x: 46, y: py, size: 8.5, font: bold, color: darkInk });
  const progW = bold.widthOfTextAtSize('Selected Programme / Course:', 8.5);
  page1.drawText(ascii(data.programmeTitle), { x: 46 + progW + 8, y: py, size: 8.5, font: bold, color: green });
  py -= 16;
  page1.drawText(`Preferred Intake: ${ascii(data.preferredIntake || data.intakeAndYear || 'January 2027')}`, { x: 46, y: py, size: 8, font: regular, color: darkInk });
  page1.drawText(`Training Area: ${ascii(data.trainingArea || 'Vocational & Applied Skills')}`, { x: 280, y: py, size: 8, font: regular, color: darkInk });
  y -= 50;

  // Section 2: Personal Details
  y = drawSectionHeader(page1, y, '2. APPLICANT PERSONAL DETAILS');
  page1.drawRectangle({ x: 38, y: y - 110, width: 519, height: 120, color: rgb(1, 1, 1), borderColor: borderCol, borderWidth: 1 });
  let dy = y - 14;
  dy = drawKeyValueRow(page1, dy, [
    { label: 'Full Names', value: data.fullNames, width: 510 }
  ]);
  dy = drawKeyValueRow(page1, dy, [
    { label: 'Date of Birth', value: data.dob || '—', width: 170 },
    { label: 'Sex / Gender', value: data.gender || '—', width: 160 },
    { label: 'Nationality', value: data.nationality || 'Zambian', width: 180 }
  ]);
  dy = drawKeyValueRow(page1, dy, [
    { label: 'NRC / Passport No.', value: data.nrcNumber || 'On file', width: 250 },
    { label: 'Mobile Number', value: data.mobileNumber || '—', width: 260 }
  ]);
  dy = drawKeyValueRow(page1, dy, [
    { label: 'WhatsApp Number', value: data.whatsappNumber || data.mobileNumber || '—', width: 250 },
    { label: 'Email Address', value: data.email || '—', width: 260 }
  ]);
  dy = drawKeyValueRow(page1, dy, [
    { label: 'Residential Address', value: data.residentialAddress || '—', width: 510 }
  ]);
  dy = drawKeyValueRow(page1, dy, [
    { label: 'District / Town', value: data.district || '—', width: 250 },
    { label: 'Province', value: data.province || '—', width: 260 }
  ]);
  y -= 130;

  // Section 3: Educational Background
  y = drawSectionHeader(page1, y, '3. EDUCATIONAL & QUALIFICATION BACKGROUND');
  page1.drawRectangle({ x: 38, y: y - 50, width: 519, height: 60, color: lightBg, borderColor: borderCol, borderWidth: 1 });
  let ey = y - 14;
  ey = drawKeyValueRow(page1, ey, [
    { label: 'Highest Grade / Qualification', value: data.highestGrade || 'Grade 12 Certificate', width: 510 }
  ]);
  ey = drawKeyValueRow(page1, ey, [
    { label: 'School / Institution Attended', value: data.schoolInstitution || 'Secondary School', width: 340 },
    { label: 'Year Completed', value: data.qualificationYear || '2025', width: 170 }
  ]);
  y -= 70;

  // ==========================================
  // PAGE 2: EMPLOYMENT, GUARDIAN & SPONSORSHIP
  // ==========================================
  const page2 = pdf.addPage([595, 842]);
  drawFormHeader(page2, 2);

  y = 736;

  // Section 4: Current Status & Occupation
  y = drawSectionHeader(page2, y, '4. CURRENT STATUS & EXPERIENCE');
  page2.drawRectangle({ x: 38, y: y - 40, width: 519, height: 50, color: rgb(1, 1, 1), borderColor: borderCol, borderWidth: 1 });
  let oy = y - 14;
  oy = drawKeyValueRow(page2, oy, [
    { label: 'Current Employment / Status', value: data.currentStatus || data.occupation || 'Applicant', width: 510 }
  ]);
  oy = drawKeyValueRow(page2, oy, [
    { label: 'Previous Relevant Experience', value: data.previousExperience || 'None stated', width: 510 }
  ]);
  y -= 60;

  // Section 5: Parent / Guardian & Emergency Contact
  y = drawSectionHeader(page2, y, '5. PARENT / GUARDIAN & EMERGENCY CONTACTS');
  page2.drawRectangle({ x: 38, y: y - 85, width: 519, height: 95, color: lightBg, borderColor: borderCol, borderWidth: 1 });
  let gy = y - 14;
  gy = drawKeyValueRow(page2, gy, [
    { label: 'Parent / Guardian Full Name', value: data.guardianName || 'Parent / Guardian', width: 320 },
    { label: 'Relationship', value: data.guardianRelationship || 'Parent', width: 190 }
  ]);
  gy = drawKeyValueRow(page2, gy, [
    { label: 'Guardian Mobile Phone', value: data.guardianMobile || '—', width: 250 },
    { label: 'Guardian Address', value: data.guardianAddress || data.residentialAddress || 'Same as applicant', width: 260 }
  ]);
  gy = drawKeyValueRow(page2, gy, [
    { label: 'Emergency Contact Person', value: data.emergencyName || data.guardianName || 'Emergency Contact', width: 320 },
    { label: 'Emergency Mobile', value: data.emergencyMobile || data.guardianMobile || '—', width: 190 }
  ]);
  y -= 105;

  // Section 6: Health & Special Needs
  y = drawSectionHeader(page2, y, '6. HEALTH & SPECIAL LEARNING SUPPORT');
  page2.drawRectangle({ x: 38, y: y - 40, width: 519, height: 50, color: rgb(1, 1, 1), borderColor: borderCol, borderWidth: 1 });
  let hy = y - 14;
  hy = drawKeyValueRow(page2, hy, [
    { label: 'Special Learning Needs', value: data.learningSupport || 'None', width: 510 }
  ]);
  hy = drawKeyValueRow(page2, hy, [
    { label: 'Health Needs / Allergies', value: data.healthDetails || data.healthNeeds || 'None', width: 510 }
  ]);
  y -= 60;

  // Section 7: Sponsorship & Fees Pathway
  y = drawSectionHeader(page2, y, '7. FEES & SPONSORSHIP PATHWAY');
  page2.drawRectangle({ x: 38, y: y - 65, width: 519, height: 75, color: lightBg, borderColor: borderCol, borderWidth: 1 });
  let sy = y - 14;
  const isCdf = data.feesPaidBy?.toLowerCase().includes('cdf') || data.sponsorName?.toLowerCase().includes('cdf');
  sy = drawKeyValueRow(page2, sy, [
    { label: 'Primary Fees Pathway', value: isCdf ? 'Constituency Development Fund (CDF Sponsorship)' : 'Self-Funded / Private Tuition', width: 510 }
  ]);
  sy = drawKeyValueRow(page2, sy, [
    { label: 'Sponsor / Payer Full Name', value: data.sponsorName || (isCdf ? 'Constituency Development Fund (CDF)' : data.fullNames), width: 320 },
    { label: 'Sponsor Contact Phone', value: data.sponsorPhone || data.mobileNumber || '—', width: 190 }
  ]);
  sy = drawKeyValueRow(page2, sy, [
    { label: 'Agreed Tuition Tariff', value: data.agreedFees || 'Standard Approved Tariff Schedule', width: 510 }
  ]);
  y -= 85;

  // ==========================================
  // PAGE 3: DECLARATION & OFFICE APPROVAL BOX
  // ==========================================
  const page3 = pdf.addPage([595, 842]);
  drawFormHeader(page3, 3);

  y = 736;

  // Section 8: Student Declaration
  y = drawSectionHeader(page3, y, '8. APPLICANT DECLARATION & AGREEMENT');
  page3.drawRectangle({ x: 38, y: y - 110, width: 519, height: 120, color: lightBg, borderColor: borderCol, borderWidth: 1 });

  const declIntro = 'I declare that the information provided on this form is true, correct and complete to the best of my knowledge. I understand that submitting false or misleading information may lead to the cancellation of my application or enrolment. I agree to abide by KASA regulations, health and safety rules, and fee payment arrangements.';
  let decY = y - 14;
  for (const line of wrap(declIntro, 8.2, 500, regular)) {
    page3.drawText(ascii(line), { x: 46, y: decY, size: 8.2, font: regular, color: darkInk });
    decY -= 12;
  }
  decY -= 8;

  page3.drawText(`Applicant Full Name: ${ascii(data.fullNames)}`, { x: 46, y: decY, size: 8.5, font: bold, color: darkInk });
  page3.drawText(`Date: ${ascii(data.applicationDate || new Date().toLocaleDateString('en-GB'))}`, { x: 360, y: decY, size: 8.5, font: bold, color: darkInk });
  decY -= 20;

  page3.drawText('Signature / Thumbprint: ___________________________________________________________', { x: 46, y: decY, size: 8.5, font: regular, color: darkInk });
  y -= 135;

  // Section 9: For Office Use Only Box
  y = drawSectionHeader(page3, y, 'FOR OFFICE USE ONLY -- KASA ADMISSIONS VERIFICATION');
  page3.drawRectangle({ x: 38, y: y - 150, width: 519, height: 160, color: rgb(0.95, 0.97, 0.95), borderColor: green, borderWidth: 1.5 });

  let offY = y - 16;
  page3.drawText(`Official Application Ref: ${ascii(data.reference)}`, { x: 48, y: offY, size: 9, font: bold, color: green });
  page3.drawText(`Status: [X] VERIFIED & ENROLLED`, { x: 340, y: offY, size: 9, font: bold, color: green });
  offY -= 18;

  page3.drawText(`Verified Enrollment Number: ${ascii(data.reference)}`, { x: 48, y: offY, size: 8.5, font: bold, color: darkInk });
  page3.drawText(`Confirmed Intake: ${ascii(data.preferredIntake || data.intakeAndYear || 'January 2027')}`, { x: 320, y: offY, size: 8.5, font: regular, color: darkInk });
  offY -= 16;

  page3.drawText(`Confirmed Training Programme: ${ascii(data.programmeTitle)}`, { x: 48, y: offY, size: 8.5, font: bold, color: darkInk });
  offY -= 16;

  page3.drawText('Verification Checklist: [X] NRC/ID Verified   [X] Entry Qualifications Checked   [X] CDF/Sponsorship Verified', {
    x: 48, y: offY, size: 8, font: regular, color: darkInk
  });
  offY -= 22;

  page3.drawText('Admissions Officer Signature: _______________________    Date: ______________', { x: 48, y: offY, size: 8.5, font: regular, color: darkInk });
  offY -= 28;

  // Official Stamp Box
  page3.drawRectangle({ x: 380, y: offY - 10, width: 150, height: 42, color: rgb(1, 1, 1), borderColor: borderCol, borderWidth: 1 });
  page3.drawText('OFFICIAL ADMISSIONS STAMP', { x: 392, y: offY + 12, size: 7, font: bold, color: mutedText });

  return await pdf.save();
}
