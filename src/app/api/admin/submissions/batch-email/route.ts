import {db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {requirePermission,operator, newId, sameOrigin, safeText} from '@/lib/security';
import type {ApplicantRecord} from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await requirePermission(req,'batch.notify');
    const body = await req.json();

    const submittedIds: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
    if (body?.ids !== undefined && !Array.isArray(body.ids)) {
      throw new HttpError(400, 'Application IDs must be provided as a list.');
    }
    if (submittedIds.length > 300) throw new HttpError(400, 'Select up to 300 applications at a time.');
    // Firestore document IDs must be validated and typed before passing to doc().
    // An explicit empty selection must never fall through to the entire student list.
    const ids: string[] = [...new Set<string>(submittedIds.map((id: unknown) => safeText(id, 60)))];
    if (ids.some(id => !/^[a-zA-Z0-9_-]{8,60}$/.test(id))) {
      throw new HttpError(400, 'One or more application IDs are invalid.');
    }
    if (body?.ids !== undefined && ids.length === 0) {
      throw new HttpError(400, 'Select at least one application.');
    }

    let submissions: ApplicantRecord[] = [];

    if (ids.length > 0) {
      const docs = await Promise.all(ids.map(id => db.collection('submissions').doc(id).get()));
      submissions = docs.filter(d => d.exists).map(d => ({id: d.id, ...d.data()} as ApplicantRecord));
    } else {
      const snap = await db.collection('submissions').where('formKind', '==', 'student').limit(300).get();
      submissions = snap.docs.map(d => ({id: d.id, ...d.data()} as ApplicantRecord));
    }

    const acceptedList = submissions.filter(s =>
      s.formKind === 'student' && ['accepted', 'letter_issued', 'cdf_submitted', 'cdf_approved', 'payment_verified', 'commission_paid'].includes(s.status)
    );

    if (acceptedList.length === 0) {
      throw new HttpError(400, 'No accepted student applications found in the selection.');
    }

    const now = new Date().toISOString();
    const batch = db.batch();
    let queuedCount = 0;
    let skippedCount = 0;

    for (const app of acceptedList) {
      const answers = app.answers || {};
      const recipientUid = typeof app.applicantUid === 'string' ? app.applicantUid.trim() : '';
      if(!recipientUid) {skippedCount++;continue;}
      const studentName = String(answers['full-name'] || answers['student-name'] || 'Student');

      const noticeId = newId();
      const docRef = db.collection('notificationOutbox').doc(noticeId);

      batch.set(docRef, {
        title: `Official KASA Admission Offer & Acceptance Pack (${app.reference})`,
        message: `Dear ${studentName},\n\nCongratulations! Your application (${app.reference}) for ${app.formTitle} has been accepted. Your official 5-page KASA Admission Offer and Acceptance Pack is ready for download in your student portal.\n\nPlease download your acceptance letter and present it to your Ward Development Committee (WDC) / CDF Council Committee for sponsorship approval.`,
        reference: app.reference,
        recipient: 'student',
        recipientUid,
        priority: 'important',
        event: 'acceptance_letter_issued',
        read: false,
        readBy: [],
        createdAt: now,
        updatedAt: now,
        createdBy: user.displayName || user.email,
        createdUid: user.uid
      });
      queuedCount++;
    }

    if(queuedCount>0)await batch.commit();

    return json({
      ok: true,
      queuedCount,
      skippedCount,
      emailSentCount: 0,
      message: `Queued ${queuedCount} private in-app acceptance notice(s); ${skippedCount} unlinked applicant(s) were skipped. No external emails were sent.`
    });
  } catch (e) {
    return fail(e);
  }
}
