import {db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {requirePermission} from '@/lib/security';
import {verifyDocumentText} from '@/lib/ocr-verifier';

export const runtime = 'nodejs';

export async function POST(req: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const actor = await requirePermission(req,'applications.review');
    const {id} = await params;
    const body = await req.json().catch(() => ({}));

    const snap = await db.collection('submissions').doc(id).get();
    if (!snap.exists) throw new HttpError(404, 'Submission not found.');
    const app = snap.data()!;

    const answers = app.answers || {};
    const claimedName = String(answers['full-name'] || answers['fullNames'] || 'Applicant');
    const claimedNrc = String(answers['nrc-number'] || answers['nrcNumber'] || '');

    // This endpoint receives staff-entered transcription, not pixels from an
    // independently scanned attachment. It must NEVER attest document validity.
    const documentText = String(body.ocrText || body.rawText || '').trim();
    if (!documentText || documentText.length > 20000) {
      throw new HttpError(400,'A staff transcription between 1 and 20,000 characters is required.');
    }

    const result = verifyDocumentText(documentText, claimedName, claimedNrc);

    // Save OCR analysis to submission document in Firestore
    await db.collection('submissions').doc(id).update({
      ocrVerification: {
        analyzedAt: new Date().toISOString(),
        source: 'manual_transcription',
        automatedVerified: false,
        independentlyVerified: false,
        transcribedBy: actor.uid,
        score: result.overallScore,
        nameSimilarity: result.nameSimilarity,
        nrcMatch: result.nrcMatch,
        extractedNrc: result.extractedNrc || null,
        needsReview: true,
        flags: [...result.flags, 'Manual transcription only: inspect original uploaded document before verification.']
      }
    });

    return json({
      ok: true,
      submissionId: id,
      reference: app.reference,
      ocrResult: {...result, needsReview: true, automatedVerified: false, source: 'manual_transcription'}
    });
  } catch (e) {
    return fail(e);
  }
}
