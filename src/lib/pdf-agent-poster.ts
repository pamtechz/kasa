import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import QRCode from 'qrcode';

function ascii(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).replace(/[^\x20-\x7e\n]/g, ' ');
}

export type AgentPosterData = {
  agentName: string;
  agentCode: string;
  district: string;
  phone?: string;
  referralLink: string;
};

export async function generateAgentPosterPdf(data: AgentPosterData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 Portrait

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const green = rgb(0.055, 0.361, 0.212);
  const gold = rgb(0.773, 0.608, 0.153);
  const darkInk = rgb(0.1, 0.16, 0.13);
  const lightBg = rgb(0.96, 0.98, 0.96);
  const borderCol = rgb(0.82, 0.88, 0.84);

  // Logo
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

  // QR Code
  let qrImage: any = null;
  try {
    const qrDataUrl = await QRCode.toDataURL(data.referralLink, {
      margin: 1,
      width: 200,
      color: { dark: '#103f2c', light: '#ffffff' }
    });
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const qrBytes = Buffer.from(base64Data, 'base64');
    qrImage = await pdf.embedPng(qrBytes);
  } catch {}

  // Header Banner
  page.drawRectangle({ x: 0, y: 720, width: 595, height: 122, color: green });
  page.drawRectangle({ x: 0, y: 712, width: 595, height: 8, color: gold });

  if (logoImage) {
    page.drawImage(logoImage, { x: 38, y: 738, width: 80, height: 82 });
  }

  page.drawText('KAMAILA ACADEMICS, SPORTS & APPRENTICESHIP', {
    x: 130, y: 798, size: 14, font: bold, color: rgb(1, 1, 1)
  });
  page.drawText('(KASA) -- HEAD | HEART | HAND', {
    x: 130, y: 782, size: 10, font: bold, color: gold
  });
  page.drawText('OFFICIAL DISTRICT RECRUITMENT & ENROLLMENT CENTER', {
    x: 130, y: 766, size: 9, font: bold, color: rgb(0.9, 0.95, 0.92)
  });
  page.drawText(`District Hub: ${ascii(data.district || 'All Districts')}  |  Contact: ${ascii(data.phone || '+260 574 203 660')}`, {
    x: 130, y: 752, size: 8.5, font: regular, color: rgb(1, 1, 1)
  });

  let y = 670;

  // Title Banner
  page.drawText('2027 JANUARY INTAKE ADMISSIONS OPEN!', {
    x: 55, y, size: 20, font: bold, color: green
  });
  y -= 20;
  page.drawText('TEVETA-Certified General Agriculture, Applied Apprenticeships & Short Courses', {
    x: 55, y, size: 11, font: bold, color: darkInk
  });
  y -= 28;

  // Key Features
  page.drawRectangle({ x: 38, y: y - 80, width: 519, height: 90, color: lightBg, borderColor: borderCol, borderWidth: 1 });
  let fy = y - 16;
  page.drawText('WHY ENROL WITH KASA?', { x: 50, y: fy, size: 11, font: bold, color: green }); fy -= 18;
  page.drawText('* 100% Practical Farm & Workshop Training at Kamaila Farming Block, Chisamba', { x: 50, y: fy, size: 9, font: regular, color: darkInk }); fy -= 15;
  page.drawText('* Constituency Development Fund (CDF) Bursary Fast-Track Offer Letters Issued', { x: 50, y: fy, size: 9, font: regular, color: darkInk }); fy -= 15;
  page.drawText('* Flexible Payment Plans & On-Site Hostel Bedspace / Meals Available', { x: 50, y: fy, size: 9, font: regular, color: darkInk });
  y -= 105;

  // Courses List Box
  page.drawRectangle({ x: 38, y: y - 150, width: 519, height: 160, color: rgb(1, 1, 1), borderColor: borderCol, borderWidth: 1 });
  let cy = y - 18;
  page.drawText('FEATURED TRAINING PROGRAMMES', { x: 50, y: cy, size: 11, font: bold, color: green }); cy -= 20;

  const courses = [
    '1. General Agriculture Trade Test Level III (TEVETA)',
    '2. Commercial Agribusiness & Irrigation Systems',
    '3. Heavy Equipment Operations & Plant Maintenance',
    '4. Automotive Mechanics & Heavy Duty Vehicle Repair',
    '5. Industrial Electrical & Solar Systems Installation',
    '6. Metal Fabrication, Arc Welding & Carpentry',
    '7. Information & Communications Technology (ICT)'
  ];

  for (const c of courses) {
    page.drawText(c, { x: 50, y: cy, size: 8.5, font: regular, color: darkInk });
    cy -= 16;
  }
  y -= 175;

  // Agent Specific Referral Box
  page.drawRectangle({ x: 38, y: y - 130, width: 519, height: 140, color: rgb(0.94, 0.97, 0.95), borderColor: green, borderWidth: 2 });
  page.drawText('APPLY THROUGH YOUR OFFICIAL DISTRICT AGENT', {
    x: 50, y: y - 18, size: 12, font: bold, color: green
  });

  page.drawText(`Official Agent Name: ${ascii(data.agentName)}`, {
    x: 50, y: y - 36, size: 10, font: bold, color: darkInk
  });
  page.drawText(`Assigned Territory: ${ascii(data.district || 'District Hub')}`, {
    x: 50, y: y - 52, size: 9, font: regular, color: darkInk
  });
  page.drawText(`Referral Code: `, {
    x: 50, y: y - 68, size: 10, font: bold, color: darkInk
  });
  page.drawText(ascii(data.agentCode), {
    x: 125, y: y - 68, size: 12, font: bold, color: green
  });

  page.drawText('Scan the QR Code on the right with your phone camera to apply online directly!', {
    x: 50, y: y - 90, size: 8, font: regular, color: darkInk
  });

  if (qrImage) {
    page.drawImage(qrImage, { x: 430, y: y - 118, width: 110, height: 110 });
  }

  // Footer
  page.drawLine({ start: { x: 38, y: 35 }, end: { x: 557, y: 35 }, thickness: 0.8, color: borderCol });
  page.drawText('KASA Admissions Office  |  Kamaila Campus, 22 Miles Chisamba  |  kasaschool.vercel.app', {
    x: 38, y: 20, size: 8, font: regular, color: rgb(0.4, 0.4, 0.4)
  });

  return await pdf.save();
}
