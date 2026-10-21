import {PDFDocument, StandardFonts, rgb} from 'pdf-lib';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import QRCode from 'qrcode';

function ascii(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).replace(/[^\x20-\x7e\n]/g, ' ');
}

export type StudentIdCardData = {
  reference: string;
  studentName: string;
  nrcNumber: string;
  programmeTitle: string;
  intakeBatch: string;
  issueDate: string;
  expiryDate: string;
  photoUrl?: string;
};

export async function generateStudentIdCardPdf(data: StudentIdCardData): Promise<Uint8Array> {
  // CR80 Standard ID Card dimensions in points (3.375" x 2.125" at 72dpi = 243pt x 153pt)
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([243, 153]);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const green = rgb(0.055, 0.361, 0.212);
  const gold = rgb(0.773, 0.608, 0.153);
  const darkInk = rgb(0.1, 0.16, 0.13);
  const mutedText = rgb(0.38, 0.46, 0.42);

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
    const verifyUrl = `https://kasaschool.vercel.app/verify/${data.reference}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 0,
      width: 100,
      color: { dark: '#103f2c', light: '#ffffff' }
    });
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const qrBytes = Buffer.from(base64Data, 'base64');
    qrImage = await pdf.embedPng(qrBytes);
  } catch {}

  // Card Outer Background & Border
  page.drawRectangle({
    x: 0, y: 0, width: 243, height: 153,
    color: rgb(0.98, 0.99, 0.98),
    borderColor: green,
    borderWidth: 1.5
  });

  // Top Green Banner
  page.drawRectangle({ x: 0, y: 122, width: 243, height: 31, color: green });
  page.drawRectangle({ x: 0, y: 119, width: 243, height: 3, color: gold });

  if (logoImage) {
    page.drawImage(logoImage, { x: 8, y: 125, width: 24, height: 24 });
  }

  page.drawText('KAMAILA ACADEMICS (KASA)', {
    x: 38, y: 138, size: 8, font: bold, color: rgb(1, 1, 1)
  });
  page.drawText('OFFICIAL STUDENT ADMISSION BADGE', {
    x: 38, y: 127, size: 5.5, font: bold, color: gold
  });

  // Student Photo Placeholder / Box
  page.drawRectangle({
    x: 10, y: 40, width: 54, height: 68,
    color: rgb(0.92, 0.95, 0.93),
    borderColor: rgb(0.7, 0.8, 0.74),
    borderWidth: 1
  });
  page.drawText('STUDENT\nPHOTO', {
    x: 16, y: 72, size: 6, font: bold, color: mutedText
  });

  // Student Details Fields
  let y = 98;
  const drawField = (label: string, value: string, fontBold = false, size = 6.5) => {
    page.drawText(`${label}: `, { x: 72, y, size: 6, font: bold, color: darkInk });
    const labelW = bold.widthOfTextAtSize(`${label}: `, 6);
    const cleanVal = ascii(value).slice(0, 32);
    page.drawText(cleanVal, {
      x: 72 + labelW, y, size, font: fontBold ? bold : regular,
      color: fontBold ? green : darkInk
    });
    y -= 11;
  };

  drawField('NAME', data.studentName, true, 7.5);
  drawField('REF ID', data.reference, true, 6.5);
  drawField('NRC NO', data.nrcNumber || 'On file');
  drawField('COURSE', data.programmeTitle);
  drawField('INTAKE', data.intakeBatch);

  // QR Code Box on Bottom Right
  if (qrImage) {
    page.drawImage(qrImage, { x: 196, y: 40, width: 38, height: 38 });
  }
  page.drawText('SCAN TO VERIFY', {
    x: 193, y: 32, size: 4.5, font: bold, color: mutedText
  });

  // Bottom Gold Strip
  page.drawRectangle({ x: 0, y: 0, width: 243, height: 16, color: green });
  page.drawText('KASA Directorate  |  Contact: +260 574 203 660  |  Valid Student Badge', {
    x: 12, y: 5, size: 5, font: regular, color: rgb(1, 1, 1)
  });

  return await pdf.save();
}
