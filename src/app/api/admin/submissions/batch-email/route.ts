import {db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {operator, newId, sameOrigin} from '@/lib/security';
import type {ApplicantRecord} from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await operator(req, ['super_admin', 'admin', 'reviewer']);
    const body = await req.json();

    const ids: string[] = Array.isArray(body.ids) ? body.ids : [];

    let submissions: ApplicantRecord[] = [];

    if (ids.length > 0) {
      const docs = await Promise.all(ids.map(id => db.collection('submissions').doc(id).get()));
      submissions = docs.filter(d => d.exists).map(d => ({id: d.id, ...d.data()} as ApplicantRecord));
    } else {
      const snap = await db.collection('submissions').where('formKind', '==', 'student').limit(300).get();
      submissions = snap.docs.map(d => ({id: d.id, ...d.data()} as ApplicantRecord));
    }

    const acceptedList = submissions.filter(s =>
      ['accepted', 'letter_issued', 'cdf_submitted', 'cdf_approved', 'payment_verified'].includes(s.status)
    );

    if (acceptedList.length === 0) {
      throw new HttpError(400, 'No accepted student applications found in the selection.');
    }

    const now = new Date().toISOString();
    const batch = db.batch();

    for (const app of acceptedList) {
      const answers = app.answers || {};
      const studentEmail = String(answers['email'] || app.answers?.['email'] || '').toLowerCase().trim();
      const studentName = String(answers['full-name'] || answers['student-name'] || 'Student');

      const noticeId = newId();
      const docRef = db.collection('notificationOutbox').doc(noticeId);

      batch.set(docRef, {
        title: `Official KASA Admission Offer & Acceptance Pack (${app.reference})`,
        message: `Dear ${studentName},\n\nCongratulations! Your application (${app.reference}) for ${app.formTitle} has been accepted. Your official 5-page KASA Admission Offer and Acceptance Pack is ready for download in your student portal.\n\nPlease download your acceptance letter and present it to your Ward Development Committee (WDC) / CDF Council Committee for sponsorship approval.`,
        reference: app.reference,
        recipient: 'all',
        recipientUid: app.answers?.['userUid'] || null,
        priority: 'important',
        event: 'acceptance_letter_issued',
        read: false,
        readBy: [],
        createdAt: now,
        updatedAt: now,
        createdBy: user.displayName || user.email,
        createdUid: user.uid
      });
    }

    await batch.commit();

    return json({
      ok: true,
      sentCount: acceptedList.length,
      message: `Successfully dispatched official Acceptance Pack notifications to ${acceptedList.length} student(s).`
    });
  } catch (e) {
    return fail(e);
  }
}
