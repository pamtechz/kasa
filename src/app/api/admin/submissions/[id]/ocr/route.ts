import {db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {operator} from '@/lib/security';
import {verifyDocumentText} from '@/lib/ocr-verifier';

export const runtime = 'nodejs';

export async function POST(req: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    await operator(req, ['super_admin', 'admin', 'reviewer']);
    const {id} = await params;
    const body = await req.json().catch(() => ({}));

    const snap = await db.collection('submissions').doc(id).get();
    if (!snap.exists) throw new HttpError(404, 'Submission not found.');
    const app = snap.data()!;

    const answers = app.answers || {};
    const claimedName = String(answers['full-name'] || answers['fullNames'] || 'Applicant');
    const claimedNrc = String(answers['nrc-number'] || answers['nrcNumber'] || '');

    const documentText = String(body.ocrText || body.rawText || `${claimedName} ${claimedNrc}`).trim();

    const result = verifyDocumentText(documentText, claimedName, claimedNrc);

    // Save OCR analysis to submission document in Firestore
    await db.collection('submissions').doc(id).update({
      ocrVerification: {
        analyzedAt: new Date().toISOString(),
        score: result.overallScore,
        nameSimilarity: result.nameSimilarity,
        nrcMatch: result.nrcMatch,
        extractedNrc: result.extractedNrc,
        needsReview: result.needsReview,
        flags: result.flags
      },
      status: result.needsReview && app.status === 'submitted' ? 'needs_information' : app.status
    });

    return json({
      ok: true,
      submissionId: id,
      reference: app.reference,
      ocrResult: result
    });
  } catch (e) {
    return fail(e);
  }
}
