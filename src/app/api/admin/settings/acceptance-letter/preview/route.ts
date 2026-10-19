import {NextRequest} from 'next/server';
import {fail} from '@/lib/errors';
import {operator} from '@/lib/security';
import {storage} from '@/lib/firebase-admin';
import {generateAcceptancePackPdf, type AcceptancePackData} from '@/lib/pdf-acceptance-pack';
import {acceptanceLetterConfigSchema} from '@/lib/acceptance-letter-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await operator(req, ['super_admin', 'admin', 'reviewer']);
    let customConfig: any = null;
    try {
      const body = await req.json();
      const parsed = acceptanceLetterConfigSchema.safeParse(body?.config || body);
      if (parsed.success) customConfig = parsed.data;
    } catch {}

    // If custom PDF mode is active, preview the custom file/link
    if (customConfig?.packSource === 'custom' && customConfig?.customPdf?.url) {
      try {
        const {type, url} = customConfig.customPdf;
        if (type === 'link' || url.startsWith('http://') || url.startsWith('https://')) {
          const fetchRes = await fetch(url, {signal: AbortSignal.timeout(8000)});
          if (fetchRes.ok) {
            const arrBuf = await fetchRes.arrayBuffer();
            return new Response(new Uint8Array(arrBuf), {
              status: 200,
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'inline; filename="KASA-Custom-Acceptance-Preview.pdf"',
                'Cache-Control': 'no-store'
              }
            });
          }
          return Response.redirect(url, 302);
        } else {
          const [fileBytes] = await storage.bucket().file(url).download();
          return new Response(new Uint8Array(fileBytes), {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'inline; filename="KASA-Custom-Acceptance-Preview.pdf"',
              'Cache-Control': 'no-store'
            }
          });
        }
      } catch (err) {
        console.error('Error serving custom preview PDF:', err);
      }
    }

    const sampleData: AcceptancePackData = {
      reference: 'KASA-2027-SAMPLE',
      date: new Date().toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'}),
      studentName: 'Mutale Mwape (Sample Applicant)',
      address: 'Plot 40, Chisamba Farming Block, Central Province',
      programme: 'General Agriculture (TEVETA Level II Trade Certificate)',
      category: 'General Agriculture (TEVETA)',
      pathway: 'Trade Test Level II (6 Months)',
      duration: '6 Months (740 hrs)',
      intake: '2027 January Intake',
      attendance: 'Boarding',
      commencementDate: '12 January 2027',
      reportingDate: '10 January 2027',
      reportingTime: '08:00 - 15:00 hrs',
      acceptanceDeadline: '24 December 2026',
      academicFees: 'K7,700 (6 Months)',
      boardingMealsFees: 'K9,000 (Meals & Bed Space)',
      totalFees: 'K16,700 (Full Package)',
      initialPayment: 'K6,680 (40% registration deposit)',
      signatory: customConfig?.letter?.signatory || 'Authorised Admissions Officer',
      signatoryTitle: customConfig?.letter?.signatoryTitle || 'Admissions Directorate / Registrar',
      fundingMethod: 'CDF',
      nrcNumber: '123456/10/1',
      phone: '+260 977 123 456'
    };

    const bytes = await generateAcceptancePackPdf(sampleData, customConfig || undefined);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="KASA-Acceptance-Pack-Preview.pdf"',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return fail(e);
  }
}
