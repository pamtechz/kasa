import type {NextRequest} from 'next/server';
import {storage, db} from '@/lib/firebase-admin';
import {fail, HttpError, json} from '@/lib/errors';
import {operator, sameOrigin, audit, newId} from '@/lib/security';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const user = await operator(req, ['super_admin', 'admin']);

    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      throw new HttpError(400, 'Select a valid PDF file to upload.');
    }

    // Accept PDF up to 25 MB
    const maxBytes = 25 * 1024 * 1024;
    if (file.size === 0 || file.size > maxBytes) {
      throw new HttpError(400, 'Acceptance pack PDF must be under 25 MB.');
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const isPdf = bytes.subarray(0, 5).toString() === '%PDF-';
    if (!isPdf) {
      throw new HttpError(400, 'The selected file is not a valid PDF document.');
    }

    const safeName = file.name.slice(0, 140).replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `acceptance-pack/${newId()}-${safeName}`;
    const fileRef = storage.bucket().file(path);

    await fileRef.save(bytes, {
      resumable: false,
      contentType: 'application/pdf',
      metadata: {
        cacheControl: 'public, max-age=3600',
        uploadedBy: user.uid,
        originalName: file.name
      }
    });

    const now = new Date().toISOString();
    const pdfData = {
      type: 'upload' as const,
      url: path,
      fileName: file.name.slice(0, 140),
      fileSize: file.size,
      uploadedAt: now
    };

    // Update settings in Firestore
    await db.collection('settings').doc('acceptanceLetter').set({
      packSource: 'custom',
      customPdf: pdfData,
      updatedAt: now,
      updatedBy: user.uid
    }, {merge: true});

    await audit(user.uid, 'settings.acceptance_pack_pdf.uploaded', 'acceptanceLetter', {
      path,
      fileName: file.name,
      size: file.size
    });

    return json({
      ok: true,
      customPdf: pdfData,
      message: 'Official Acceptance Pack PDF uploaded and saved.'
    }, 201);
  } catch (e) {
    return fail(e);
  }
}
