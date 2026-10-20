import {db} from '@/lib/firebase-admin';
import {fail, HttpError, json} from '@/lib/errors';
import {populateDynamicOptions} from '@/lib/form-options';
import type {FormSchema} from '@/lib/types';
import {newId} from '@/lib/security';

export const runtime = 'nodejs';

export async function GET(req: Request, {params}: {params: Promise<{slug: string}>}) {
  try {
    const {slug} = await params;
    const url = new URL(req.url);
    const refCode = url.searchParams.get('ref') || url.searchParams.get('agent') || '';

    // Record referral link click analytics if a ref code is present
    if (refCode && refCode.trim()) {
      try {
        const cleanCode = refCode.trim().toUpperCase();
        await db.collection('referralClicks').add({
          id: newId(),
          code: cleanCode,
          slug,
          timestamp: new Date().toISOString(),
          userAgent: req.headers.get('user-agent') || 'browser',
          referer: req.headers.get('referer') || ''
        });
      } catch (err) {
        console.warn('Referral click tracking error:', err);
      }
    }

    // Lookup form by exact slug
    let result = await db.collection('forms').where('slug', '==', slug).limit(1).get();

    // Fallback: If exact slug is unpublished or not found, find any published student/agent form
    if (result.empty || !result.docs[0].data().published) {
      result = await db.collection('forms').where('published', '==', true).limit(1).get();
    }

    if (result.empty) {
      throw new HttpError(404, 'This application form is not currently accepting submissions.');
    }

    const formDoc = result.docs[0];
    const formData = formDoc.data();

    // Return published form schema with dynamic option choices
    return json({
      form: await populateDynamicOptions({
        ...formData,
        id: formDoc.id,
        published: true
      } as FormSchema)
    });
  } catch (e) {
    return fail(e);
  }
}
