import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import QRCode from 'qrcode';
import {
  type AcceptanceLetterConfig,
  defaultAcceptanceLetterConfig
} from './acceptance-letter-config';

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

function hexToRgb(hex: string, fallback = rgb(0.06, 0.25, 0.17)) {
  try {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return fallback;
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    return rgb(r, g, b);
  } catch {
    return fallback;
  }
}

export type AcceptancePackData = {
  reference: string;
  date: string;
  studentName: string;
  address: string;
  programme: string;
  category: 'Agri-Sport' | 'Independent short course' | 'General Agriculture (TEVETA)';
  pathway: string;
  duration: string;
  intake: string;
  attendance: 'Day' | 'Boarding';
  commencementDate: string;
  reportingDate: string;
  reportingTime: string;
  acceptanceDeadline: string;
  academicFees: string;
  boardingMealsFees: string;
  totalFees: string;
  initialPayment: string;
  signatory: string;
  signatoryTitle: string;
  fundingMethod: string;
  nrcNumber?: string;
  phone?: string;
};

export async function generateAcceptancePackPdf(
  data: AcceptancePackData,
  customConfig?: Partial<AcceptanceLetterConfig>
): Promise<Uint8Array> {
  const cfg: AcceptanceLetterConfig = {
    ...defaultAcceptanceLetterConfig,
    ...customConfig,
    institution: {...defaultAcceptanceLetterConfig.institution, ...(customConfig?.institution || {})},
    letter: {...defaultAcceptanceLetterConfig.letter, ...(customConfig?.letter || {})},
    fees: {...defaultAcceptanceLetterConfig.fees, ...(customConfig?.fees || {})},
    requirements: {...defaultAcceptanceLetterConfig.requirements, ...(customConfig?.requirements || {})},
    courseRequirements: {...defaultAcceptanceLetterConfig.courseRequirements, ...(customConfig?.courseRequirements || {})}
  };

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let embeddedTemplate: any = null;
  try {
    const templateBytes = await readFile(join(process.cwd(), 'public', 'kasa-headed-paper-template.pdf'));
    const templateDoc = await PDFDocument.load(templateBytes);
    const [tPage] = await pdf.embedPdf(templateDoc, [0]);
    embeddedTemplate = tPage;
  } catch {}

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

  let qrImage: any = null;
  try {
    const verifyUrl = `https://kasaschool.vercel.app/verify/${data.reference}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 1,
      width: 140,
      color: { dark: '#103f2c', light: '#ffffff' }
    });
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const qrBytes = Buffer.from(base64Data, 'base64');
    qrImage = await pdf.embedPng(qrBytes);
  } catch {}

  const green = hexToRgb(cfg.institution.primaryColorHex, rgb(0.055, 0.361, 0.212));
  const gold = hexToRgb(cfg.institution.goldColorHex, rgb(0.773, 0.608, 0.153));
  const darkInk = rgb(0.1, 0.16, 0.13);
  const mutedText = rgb(0.38, 0.46, 0.42);
  const lightBg = rgb(0.96, 0.98, 0.96);
  const borderCol = rgb(0.82, 0.88, 0.84);
  const tableHeaderBg = green;

  // Exact Official Headed Paper Banner on every page
  function drawHeadedPaper(page: any, pageNum: number) {
    if (embeddedTemplate) {
      page.drawPage(embeddedTemplate, {x: 0, y: 0, width: 595, height: 842});
      page.drawText(`Page ${pageNum} of 5`, {
        x: 520, y: 84, size: 7.5, font: italic, color: mutedText
      });
      return;
    }

    // High fidelity fallback matching the exact attached official paper:
    // 1. Top Right Diagonal Polygons (Green & Gold)
    page.drawSvgPath('M 328 0 L 595 0 L 595 74 Z', {
      x: 0, y: 842, color: green
    });
    page.drawSvgPath('M 460 0 L 595 0 L 595 42 Z', {
      x: 0, y: 842, color: gold
    });

    // 2. KASA Crest Logo on white header background
    if (logoImage) {
      page.drawImage(logoImage, {x: 40, y: 746, width: 68, height: 70});
    }

    // 3. Institution Title & Contacts (Beside logo on white background)
    page.drawText(ascii(cfg.institution.name || 'KAMAILA ACADEMICS, SPORTS & APPRENTICESHIP'), {
      x: 118, y: 804, size: 12, font: bold, color: rgb(0.055, 0.29, 0.18)
    });
    page.drawText(ascii(cfg.institution.motto || '(KASA) -- HEAD | HEART | HAND'), {
      x: 118, y: 791, size: 8.8, font: bold, color: gold
    });
    page.drawText(ascii(cfg.institution.lusakaAddress || 'House No. 40, Civic Centre, Area 22, Lusaka, Zambia'), {
      x: 118, y: 778, size: 7.8, font: regular, color: rgb(0.29, 0.33, 0.40)
    });
    page.drawText(ascii(cfg.institution.campusAddress || 'Kamaila Farming Block, 22 Miles, After Protea Hotel, Junken Rd, Chisamba'), {
      x: 118, y: 767, size: 7.8, font: regular, color: rgb(0.29, 0.33, 0.40)
    });
    page.drawText(`Contact: ${ascii(cfg.institution.phone || '+260 574 203 660')} | Email: ${ascii(cfg.institution.email || 'kasa@zamfirm.com')}`, {
      x: 118, y: 756, size: 7.8, font: regular, color: rgb(0.20, 0.25, 0.33)
    });

    // 4. Central Subtle Watermark
    if (logoImage) {
      page.drawImage(logoImage, {
        x: (595 - 330) / 2,
        y: (842 - 330) / 2,
        width: 330,
        height: 330,
        opacity: 0.05
      });
    }

    // 5. Two-Tier Footer
    // Upper gold band (3 Pillars with bullet points)
    page.drawRectangle({x: 25, y: 34, width: 545, height: 42, color: gold});
    page.drawText('* General Agriculture: Practical production & management across crops, horticulture, poultry, livestock, aquaculture, pasture & feed production', {
      x: 35, y: 64, size: 6.8, font: bold, color: rgb(1, 1, 1)
    });
    page.drawText('* Sports Development: Professional training for football and athletics trainers.', {
      x: 35, y: 53, size: 6.8, font: bold, color: rgb(1, 1, 1)
    });
    page.drawText('* Cooperative Development: Cooperative formation, enterprise development & organizational skills management.', {
      x: 35, y: 42, size: 6.8, font: bold, color: rgb(1, 1, 1)
    });

    // Lower green band (Institution name, email, phone)
    page.drawRectangle({x: 25, y: 0, width: 545, height: 32, color: green});
    page.drawText(ascii(cfg.institution.name || 'KAMAILA ACADEMICS, SPORTS & APPRENTICESHIP'), {
      x: 38, y: 11, size: 8, font: bold, color: rgb(1, 1, 1)
    });
    page.drawText(ascii(cfg.institution.email || 'kasa@zamfirm.com'), {
      x: 260, y: 11, size: 8, font: regular, color: rgb(1, 1, 1)
    });
    page.drawText(ascii(cfg.institution.phone || '+260 574 203 660'), {
      x: 450, y: 11, size: 8, font: bold, color: rgb(1, 1, 1)
    });

    page.drawText(`Page ${pageNum} of 5`, {
      x: 520, y: 84, size: 7.5, font: italic, color: mutedText
    });
  }

  function drawHeader(page: any, pageNum = 1) {
    if (pageNum === 1) {
      drawHeadedPaper(page, pageNum);
      return;
    }

    // Clean minimal continuation running header for pages 2, 3, 4, 5 (Headed paper on page 1 only)
    page.drawText(ascii(cfg.institution.name || 'KAMAILA ACADEMICS, SPORTS & APPRENTICESHIP (KASA)'), {
      x: 40, y: 808, size: 8.5, font: bold, color: green
    });
    page.drawText(`Acceptance Pack  |  Ref: ${ascii(data.reference)}  |  Page ${pageNum} of 5`, {
      x: 350, y: 808, size: 8, font: regular, color: mutedText
    });
    page.drawLine({start: {x: 38, y: 800}, end: {x: 557, y: 800}, thickness: 0.8, color: borderCol});

    // Clean continuation footer
    page.drawLine({start: {x: 38, y: 35}, end: {x: 557, y: 35}, thickness: 0.5, color: borderCol});
    page.drawText(`KASA Official Acceptance Document  |  Student: ${ascii(data.studentName)}`, {
      x: 40, y: 22, size: 8, font: regular, color: mutedText
    });
    page.drawText(`Page ${pageNum} of 5`, {
      x: 510, y: 22, size: 8, font: bold, color: green
    });
  }

  function drawFooter(page: any, _pageNum: number) {
    // Header and footer are drawn together in exact harmony
  }

  // ==========================================
  // PAGE 1: LETTER OF ACCEPTANCE
  // ==========================================
  const page1 = pdf.addPage([595, 842]);
  drawHeader(page1, 1);

  let y = 734;
  page1.drawText(`Our reference: ${ascii(data.reference)}`, {x: 40, y, size: 9.5, font: bold, color: darkInk});
  page1.drawText(`Date: ${ascii(data.date)}`, {x: 380, y, size: 9.5, font: regular, color: darkInk});
  y -= 15;
  page1.drawText(`Student full name: ${ascii(data.studentName)}`, {x: 40, y, size: 9.5, font: bold, color: darkInk});
  y -= 14;
  page1.drawText(`Postal or residential address: ${ascii(data.address || 'Lusaka / Central Province, Zambia')}`, {
    x: 40, y, size: 8.5, font: regular, color: mutedText
  });
  y -= 18;

  page1.drawText(ascii(cfg.letter.salutation), {x: 40, y, size: 9.5, font: bold, color: darkInk});
  y -= 18;

  page1.drawText(ascii(cfg.letter.title), {x: 40, y, size: 14, font: bold, color: green});
  y -= 14;
  for (const l of wrap(cfg.letter.introText, 9, 515, regular)) {
    page1.drawText(ascii(l), {x: 40, y, size: 9, font: regular, color: darkInk});
    y -= 12;
  }
  y -= 6;

  const drawField = (label: string, value: string, curX: number, curY: number, maxColumnW = 230) => {
    page1.drawText(`${label}: `, {x: curX, y: curY, size: 8.5, font: bold, color: darkInk});
    const labelW = bold.widthOfTextAtSize(`${label}: `, 8.5);
    let size = 8.5;
    const cleanVal = ascii(value).trim();
    while (size > 6.5 && regular.widthOfTextAtSize(cleanVal, size) > maxColumnW - labelW) {
      size -= 0.5;
    }
    page1.drawText(cleanVal, {x: curX + labelW, y: curY, size, font: regular, color: darkInk});
  };

  // Details box
  page1.drawRectangle({x: 38, y: y - 104, width: 519, height: 114, color: lightBg, borderColor: borderCol, borderWidth: 1});
  let gy = y - 2;
  drawField('Programme or course', data.programme, 46, gy); gy -= 16;
  drawField('Category', data.category, 46, gy);
  drawField('Pathway or level', data.pathway || 'Foundation / Applied Certificate', 290, gy); gy -= 16;
  drawField('Duration', data.duration, 46, gy);
  drawField('Intake and year', data.intake, 290, gy); gy -= 16;
  drawField('Attendance', data.attendance, 46, gy);
  drawField('Commencement date', data.commencementDate || 'January 2027', 290, gy); gy -= 16;
  drawField('Reporting date', data.reportingDate || 'Reporting instructions attached', 46, gy);
  drawField('Reporting time', data.reportingTime || '08:00 - 15:00 hrs', 290, gy); gy -= 16;
  drawField('Acceptance deadline', data.acceptanceDeadline || '14 days from issue date', 46, gy);
  y -= 118;

  // Fees schedule box
  page1.drawRectangle({x: 38, y: y - 38, width: 519, height: 44, color: rgb(0.93, 0.96, 0.94), borderColor: borderCol, borderWidth: 1});
  let fy = y - 4;
  drawField('Academic fees ZMW', data.academicFees, 46, fy);
  drawField('Boarding and meals ZMW', data.boardingMealsFees || 'K0.00 (Day scholar)', 290, fy);
  fy -= 16;
  drawField('Total approved fees ZMW', data.totalFees, 46, fy);
  drawField('Initial payment ZMW', data.initialPayment || 'Refer to fee schedule', 290, fy);
  y -= 50;

  // Instructions
  for (const l of wrap(cfg.letter.instructionsText1, 8.5, 515, regular)) {
    page1.drawText(ascii(l), {x: 40, y, size: 8.5, font: regular, color: darkInk});
    y -= 11.5;
  }
  y -= 3;
  for (const l of wrap(cfg.letter.instructionsText2, 8.5, 515, regular)) {
    page1.drawText(ascii(l), {x: 40, y, size: 8.5, font: regular, color: darkInk});
    y -= 11.5;
  }
  y -= 3;
  for (const l of wrap(cfg.letter.reportingDirections, 8.5, 515, regular)) {
    page1.drawText(ascii(l), {x: 40, y, size: 8.5, font: regular, color: darkInk});
    y -= 11.5;
  }
  y -= 5;

  page1.drawText(ascii(cfg.letter.welcomeText), {x: 40, y, size: 9, font: bold, color: green});
  y -= 14;
  page1.drawText(ascii(cfg.letter.closing), {x: 40, y, size: 8.5, font: regular, color: darkInk});
  y -= 26;

  page1.drawLine({start: {x: 40, y}, end: {x: 230, y}, thickness: 0.8, color: darkInk});
  page1.drawRectangle({x: 380, y: y - 10, width: 140, height: 42, color: rgb(0.98, 0.98, 0.98), borderColor: borderCol, borderWidth: 1});
  page1.drawText(ascii(cfg.letter.officialStampText), {x: 388, y: y + 16, size: 7.5, font: bold, color: mutedText});
  if (qrImage) {
    page1.drawImage(qrImage, { x: 472, y: y - 8, width: 38, height: 38 });
  }

  page1.drawText(ascii(data.signatory || cfg.letter.signatory), {x: 40, y: y - 12, size: 8.8, font: bold, color: darkInk});
  page1.drawText(ascii(data.signatoryTitle || cfg.letter.signatoryTitle), {x: 40, y: y - 22, size: 8, font: regular, color: mutedText});

  page1.drawText('This document includes the course fees, reporting requirements and student acceptance form.', {
    x: 40, y: y - 38, size: 7.8, font: italic, color: mutedText
  });
  drawFooter(page1, 1);

  // ==========================================
  // PAGE 2: COURSES AND FEES
  // ==========================================
  const page2 = pdf.addPage([595, 842]);
  drawHeader(page2, 2);

  y = 734;
  page2.drawText('COURSES AND FEES', {x: 40, y, size: 14, font: bold, color: green});
  y -= 14;
  page2.drawText('Proposed fees from the supplied KASA schedule, in Zambian kwacha (ZMW).', {
    x: 40, y, size: 8.5, font: italic, color: mutedText
  });
  y -= 18;

  // Main Programmes Table
  page2.drawText('Main programmes', {x: 40, y, size: 10, font: bold, color: darkInk});
  y -= 14;

  // Table header
  page2.drawRectangle({x: 38, y: y - 2, width: 519, height: 16, color: tableHeaderBg});
  page2.drawText('Programme or qualification route', {x: 44, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1)});
  page2.drawText('Duration', {x: 350, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1)});
  page2.drawText('Academic fee ZMW', {x: 460, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1)});
  y -= 16;

  for (let i = 0; i < cfg.fees.mainProgrammes.length; i++) {
    const item = cfg.fees.mainProgrammes[i];
    const rowBg = i % 2 === 0 ? lightBg : rgb(1, 1, 1);
    page2.drawRectangle({x: 38, y: y - 2, width: 519, height: 15, color: rowBg, borderColor: borderCol, borderWidth: 0.5});
    page2.drawText(ascii(item.name), {x: 44, y: y + 2, size: 7.8, font: regular, color: darkInk});
    page2.drawText(ascii(item.duration), {x: 350, y: y + 2, size: 7.8, font: regular, color: darkInk});
    page2.drawText(ascii(item.fee), {x: 465, y: y + 2, size: 7.8, font: bold, color: darkInk});
    y -= 15;
  }
  y -= 12;

  // Independent Short Courses Table
  page2.drawText('Independent short courses', {x: 40, y, size: 10, font: bold, color: darkInk});
  y -= 14;

  page2.drawRectangle({x: 38, y: y - 2, width: 519, height: 16, color: tableHeaderBg});
  page2.drawText('Short course', {x: 44, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1)});
  page2.drawText('Duration', {x: 350, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1)});
  page2.drawText('Academic fee ZMW', {x: 460, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1)});
  y -= 16;

  for (let i = 0; i < cfg.fees.shortCourses.length; i++) {
    const item = cfg.fees.shortCourses[i];
    const rowBg = i % 2 === 0 ? lightBg : rgb(1, 1, 1);
    page2.drawRectangle({x: 38, y: y - 2, width: 519, height: 14, color: rowBg, borderColor: borderCol, borderWidth: 0.5});
    page2.drawText(ascii(item.name), {x: 44, y: y + 2, size: 7.6, font: regular, color: darkInk});
    page2.drawText(ascii(item.duration), {x: 350, y: y + 2, size: 7.6, font: regular, color: darkInk});
    page2.drawText(ascii(item.fee), {x: 465, y: y + 2, size: 7.6, font: bold, color: darkInk});
    y -= 14;
  }
  y -= 12;

  // Boarding meals and payment arrangements
  page2.drawText('Boarding meals and payment arrangements', {x: 40, y, size: 10, font: bold, color: darkInk});
  y -= 14;
  page2.drawText(`Hostel bedspace: ${ascii(cfg.fees.hostelBedspaceMonthly)} Meals: ${ascii(cfg.fees.mealsMonthly)}`, {
    x: 40, y, size: 8, font: regular, color: darkInk
  });
  y -= 13;
  for (const l of wrap(cfg.fees.instalmentNote, 8, 515, regular)) {
    page2.drawText(ascii(l), {x: 40, y, size: 8, font: regular, color: darkInk});
    y -= 12;
  }
  y -= 10;
  page2.drawText('Approved payment amounts and due dates: _______________________________________________________', {
    x: 40, y, size: 8, font: regular, color: mutedText
  });
  y -= 14;
  page2.drawText('Cancellation and refund terms as explained: _______________________________________________________', {
    x: 40, y, size: 8, font: regular, color: mutedText
  });
  y -= 14;
  page2.drawText('KASA must confirm the approved tariff before issue. A separate Agri-Sport fee must be entered in the offer letter.', {
    x: 40, y, size: 7.5, font: italic, color: mutedText
  });

  drawFooter(page2, 2);

  // ==========================================
  // PAGE 3: PERSONAL AND SCHOOL REQUIREMENTS
  // ==========================================
  const page3 = pdf.addPage([595, 842]);
  drawHeader(page3, 3);

  y = 734;
  page3.drawText('PERSONAL AND SCHOOL REQUIREMENTS', {x: 40, y, size: 14, font: bold, color: green});
  y -= 14;
  page3.drawText('Use this checklist when preparing to report. Tick items supplied or arranged. KASA should mark items that do not apply.', {
    x: 40, y, size: 8.5, font: italic, color: mutedText
  });
  y -= 18;

  const drawChecklist = (title: string, items: string[]) => {
    page3.drawText(title, {x: 40, y, size: 9.5, font: bold, color: darkInk});
    y -= 14;
    for (const item of items) {
      page3.drawText('[  ]', {x: 44, y, size: 8, font: bold, color: green});
      const lines = wrap(item, 8, 485, regular);
      page3.drawText(ascii(lines[0]), {x: 62, y, size: 8, font: regular, color: darkInk});
      y -= 12;
      for (let k = 1; k < lines.length; k++) {
        page3.drawText(ascii(lines[k]), {x: 62, y, size: 8, font: regular, color: darkInk});
        y -= 12;
      }
    }
    y -= 6;
  };

  drawChecklist('A  Admission and school records', cfg.requirements.checklistA);
  drawChecklist('B  School and classroom materials', cfg.requirements.checklistB);
  drawChecklist('C  Personal requirements', cfg.requirements.checklistC);
  drawChecklist('D  Boarding requirements if applicable', cfg.requirements.checklistD);

  page3.drawText('Items KASA must confirm before purchase or reporting', {x: 40, y, size: 9, font: bold, color: darkInk});
  y -= 14;
  page3.drawText('Uniform or school dress requirements if applicable: _________________________________________________', {
    x: 40, y, size: 8, font: regular, color: mutedText
  });
  y -= 14;
  page3.drawText('Mattress room key lock or other hostel items supplied: _______________________________________________', {
    x: 40, y, size: 8, font: regular, color: mutedText
  });
  y -= 14;
  page3.drawText('Additional personal or school items and quantities: __________________________________________________', {
    x: 40, y, size: 8, font: regular, color: mutedText
  });

  drawFooter(page3, 3);

  // ==========================================
  // PAGE 4: COURSE REQUIREMENTS
  // ==========================================
  const page4 = pdf.addPage([595, 842]);
  drawHeader(page4, 4);

  y = 734;
  page4.drawText('COURSE REQUIREMENTS', {x: 40, y, size: 14, font: bold, color: green});
  y -= 14;
  page4.drawText('Bring the items for the programme stated in your letter. For an independent short course, use the relevant row below.', {
    x: 40, y, size: 8.5, font: italic, color: mutedText
  });
  y -= 18;

  // Section A
  page4.drawText('A  Agri-Sport Foundation and Applied programmes', {x: 40, y, size: 9.5, font: bold, color: darkInk});
  y -= 14;
  for (const l of wrap(cfg.courseRequirements.agriSportText, 8, 515, regular)) {
    page4.drawText(ascii(l), {x: 40, y, size: 8, font: regular, color: darkInk});
    y -= 12;
  }
  y -= 10;

  // Section B
  page4.drawText('B  General Agriculture TEVETA pathway', {x: 40, y, size: 9.5, font: bold, color: darkInk});
  y -= 14;
  page4.drawRectangle({x: 38, y: y - 2, width: 519, height: 16, color: tableHeaderBg});
  page4.drawText('Level', {x: 44, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1)});
  page4.drawText('Student supplied practical items', {x: 130, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1)});
  y -= 16;

  for (let i = 0; i < cfg.courseRequirements.tevetaLevels.length; i++) {
    const item = cfg.courseRequirements.tevetaLevels[i];
    const rowBg = i % 2 === 0 ? lightBg : rgb(1, 1, 1);
    page4.drawRectangle({x: 38, y: y - 2, width: 519, height: 15, color: rowBg, borderColor: borderCol, borderWidth: 0.5});
    page4.drawText(ascii(item.level), {x: 44, y: y + 2, size: 7.8, font: bold, color: darkInk});
    page4.drawText(ascii(item.items), {x: 130, y: y + 2, size: 7.8, font: regular, color: darkInk});
    y -= 15;
  }
  y -= 12;

  // Section C
  page4.drawText('C  Independent short courses', {x: 40, y, size: 9.5, font: bold, color: darkInk});
  y -= 14;
  page4.drawRectangle({x: 38, y: y - 2, width: 519, height: 16, color: tableHeaderBg});
  page4.drawText('Short course', {x: 44, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1)});
  page4.drawText('Student supplied items and participation requirements', {x: 180, y: y + 2, size: 8, font: bold, color: rgb(1, 1, 1)});
  y -= 16;

  for (let i = 0; i < cfg.courseRequirements.shortCoursesList.length; i++) {
    const item = cfg.courseRequirements.shortCoursesList[i];
    const rowBg = i % 2 === 0 ? lightBg : rgb(1, 1, 1);
    page4.drawRectangle({x: 38, y: y - 2, width: 519, height: 14, color: rowBg, borderColor: borderCol, borderWidth: 0.5});
    page4.drawText(ascii(item.course), {x: 44, y: y + 2, size: 7.5, font: bold, color: darkInk});
    page4.drawText(ascii(item.requirements), {x: 180, y: y + 2, size: 7.5, font: regular, color: darkInk});
    y -= 14;
  }
  y -= 12;

  for (const l of wrap(cfg.courseRequirements.sharedToolsNote, 8, 515, regular)) {
    page4.drawText(ascii(l), {x: 40, y, size: 8, font: regular, color: darkInk});
    y -= 11.5;
  }
  y -= 10;
  page4.drawText('Additional course items confirmed by KASA: _______________________________________________________', {
    x: 40, y, size: 8, font: regular, color: mutedText
  });

  drawFooter(page4, 4);

  // ==========================================
  // PAGE 5: ADMISSION ACCEPTANCE FORM
  // ==========================================
  const page5 = pdf.addPage([595, 842]);
  drawHeader(page5, 5);

  y = 734;
  page5.drawText('ADMISSION ACCEPTANCE FORM', {x: 40, y, size: 14, font: bold, color: green});
  y -= 14;
  page5.drawText('Complete in BLOCK CAPITALS, tick the applicable boxes and return this page to the Admissions Office by the deadline.', {
    x: 40, y, size: 8.2, font: italic, color: mutedText
  });
  y -= 16;

  page5.drawText(`Offer reference: ${ascii(data.reference)}`, {x: 40, y, size: 9, font: bold, color: darkInk});
  page5.drawText(`Date of offer letter: ${ascii(data.date)}`, {x: 360, y, size: 9, font: regular, color: darkInk});
  y -= 18;

  // SECTION A
  page5.drawRectangle({x: 38, y: y - 2, width: 519, height: 16, color: green});
  page5.drawText('A  STUDENT AND PROGRAMME DETAILS', {x: 44, y: y + 2, size: 9, font: bold, color: rgb(1, 1, 1)});
  y -= 18;

  page5.drawText(`Student full name: ${ascii(data.studentName)}`, {x: 40, y, size: 8.5, font: regular, color: darkInk});
  y -= 14;
  page5.drawText(`NRC or passport number: ${ascii(data.nrcNumber || 'On file')}`, {x: 40, y, size: 8.5, font: regular, color: darkInk});
  page5.drawText(`Mobile number: ${ascii(data.phone || 'On file')}`, {x: 320, y, size: 8.5, font: regular, color: darkInk});
  y -= 14;
  page5.drawText(`Category: [X] ${ascii(data.category)}`, {x: 40, y, size: 8.5, font: regular, color: darkInk});
  y -= 14;
  page5.drawText(`Programme or course offered: ${ascii(data.programme)}`, {x: 40, y, size: 8.5, font: regular, color: darkInk});
  y -= 14;
  page5.drawText(`Intake and year: ${ascii(data.intake)}`, {x: 40, y, size: 8.5, font: regular, color: darkInk});
  page5.drawText(`Attendance: [X] ${ascii(data.attendance)}`, {x: 320, y, size: 8.5, font: regular, color: darkInk});
  y -= 18;

  // SECTION B
  page5.drawRectangle({x: 38, y: y - 2, width: 519, height: 16, color: green});
  page5.drawText('B  ACCEPTANCE OF THE OFFER', {x: 44, y: y + 2, size: 9, font: bold, color: rgb(1, 1, 1)});
  y -= 18;

  const bText = 'I accept the offer for the programme stated above and confirm that my details are correct. I have read the letter, fees and requirements in this document, and agree to KASA\'s approved payment terms, attendance, conduct and safety rules.';
  for (const l of wrap(bText, 8.2, 515, regular)) {
    page5.drawText(ascii(l), {x: 40, y, size: 8.2, font: regular, color: darkInk});
    y -= 11.5;
  }
  y -= 4;

  page5.drawText('I have received and understood the following information:', {x: 40, y, size: 8.2, font: bold, color: darkInk});
  y -= 13;
  page5.drawText('[X] Programme and certification arrangements        [X] Fees and payment terms', {x: 48, y, size: 8.2, font: regular, color: darkInk});
  y -= 12;
  page5.drawText('[X] Personal school and course requirements          [X] Cancellation and refund terms', {x: 48, y, size: 8.2, font: regular, color: darkInk});
  y -= 18;

  page5.drawText('Student signature / thumbprint: _________________________________', {x: 40, y, size: 8.5, font: regular, color: darkInk});
  page5.drawText('Date: _______________', {x: 400, y, size: 8.5, font: regular, color: darkInk});
  y -= 20;

  // SECTION C
  page5.drawRectangle({x: 38, y: y - 2, width: 519, height: 16, color: green});
  page5.drawText('C  FUNDING ARRANGEMENTS', {x: 44, y: y + 2, size: 9, font: bold, color: rgb(1, 1, 1)});
  y -= 18;

  const isCdf = data.fundingMethod?.toLowerCase().includes('cdf');
  page5.drawText(`${isCdf ? '[X]' : '[ ]'} Sponsor or CDF approved     ${!isCdf ? '[X]' : '[ ]'} Self-funded     [ ] Sponsorship application pending`, {
    x: 48, y, size: 8.5, font: regular, color: darkInk
  });
  y -= 14;
  page5.drawText(`Payer or sponsor: ${ascii(isCdf ? 'Constituency Development Fund (CDF)' : data.studentName)}`, {x: 40, y, size: 8.5, font: regular, color: darkInk});
  page5.drawText(`Contact number: ${ascii(data.phone || '—')}`, {x: 360, y, size: 8.5, font: regular, color: darkInk});
  y -= 20;

  // SECTION D
  page5.drawRectangle({x: 38, y: y - 2, width: 519, height: 16, color: green});
  page5.drawText('D  PARENT OR GUARDIAN CONSENT IF THE STUDENT IS UNDER 18', {x: 44, y: y + 2, size: 9, font: bold, color: rgb(1, 1, 1)});
  y -= 16;
  page5.drawText('I consent to the student\'s enrolment and participation in the supervised training activities described by KASA and acknowledge the requirements in this document.', {
    x: 40, y, size: 8, font: italic, color: darkInk
  });
  y -= 14;
  page5.drawText('Parent or guardian full name: ___________________________________________________________', {x: 40, y, size: 8, font: regular, color: darkInk});
  y -= 13;
  page5.drawText('Relationship: __________________________   Contact number: _____________________________', {x: 40, y, size: 8, font: regular, color: darkInk});
  y -= 13;
  page5.drawText('Signature or thumbprint: _________________________________   Date: _____________________', {x: 40, y, size: 8, font: regular, color: darkInk});
  y -= 18;

  // FOR OFFICE USE ONLY
  page5.drawRectangle({x: 38, y: y - 36, width: 519, height: 42, color: rgb(0.95, 0.96, 0.95), borderColor: borderCol, borderWidth: 1});
  page5.drawText('FOR OFFICE USE ONLY & DOCUMENT VERIFICATION', {x: 44, y: y - 8, size: 8, font: bold, color: rgb(0.7, 0.2, 0.2)});
  page5.drawText('Received by: ________________________  Date: __________  Status: [X] ADMITTED', {
    x: 44, y: y - 24, size: 8, font: regular, color: darkInk
  });
  if (qrImage) {
    page5.drawImage(qrImage, { x: 508, y: y - 34, width: 38, height: 38 });
  }

  drawFooter(page5, 5);

  return await pdf.save();
}
