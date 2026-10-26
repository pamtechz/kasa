import {db} from '@/lib/firebase-admin';
import {sendSchoolPush} from '@/lib/mobile-push';
import {operator, newId, safeText, sameOrigin} from '@/lib/security';
import {fail, json, HttpError} from '@/lib/errors';
import {getGeneralCache, setGeneralCache, invalidateGeneralCache} from '@/lib/server-cache';

function canReadNotice(user:{uid:string;role:string},notice:Record<string,unknown>):boolean{
  if(['super_admin','admin'].includes(user.role)) return true;
  if(typeof notice.recipientUid==='string' && notice.recipientUid) return notice.recipientUid===user.uid;
  // Legacy broadcast notices sometimes contain applicants' names, references
  // and funding details. Never expose these to an unrelated learner/agent.
  if((notice.reference || notice.submissionId) && ['student','agent'].includes(user.role))return false;
  return notice.recipient==='all' || notice.recipient===user.role;
}
function safeNotice<T extends Record<string,unknown>>(notice:T):T{
  if(typeof notice.message!=='string')return notice;
  const redact = (text: string) => text.replace(/(\b(?:temporary|temp|initial|one[- ]time)?\s*password\s*[:=\-]\s*)\S+/gi, '$1[REDACTED]');
  return {...notice,message:redact(notice.message),...(typeof notice.title==='string'?{title:redact(notice.title)}:{})} as T;
}

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const user = await operator(req, ['super_admin', 'admin', 'reviewer', 'agent', 'student']);
    const cacheKey = `notifications-${user.role}-${user.uid}`;
    const cached = getGeneralCache<{notifications: any[]}>(cacheKey);
    if (cached) return json(cached);

    const items = await db.collection('notificationOutbox').limit(300).get();
    const notifications = items.docs
      .map(d => ({id: d.id, ...d.data()}))
      .filter((x: any) => canReadNotice(user,x))
      .map((x: any) => safeNotice(x))
      .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, 150);

    const res = {notifications};
    setGeneralCache(cacheKey, res);
    return json(res);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await operator(req, ['super_admin', 'admin', 'reviewer']);
    const body = await req.json();

    const title = safeText(body.title, 120);
    const message = safeText(body.message, 1000);
    const reference = safeText(body.reference, 50) || 'SYSTEM';
    const recipient = ['all', 'admin', 'reviewer', 'agent'].includes(body.recipient) ? body.recipient : 'all';
    const priority = ['info', 'important', 'urgent'].includes(body.priority) ? body.priority : 'info';
    const event = safeText(body.event, 50) || 'broadcast';

    if (!title) throw new HttpError(400, 'Notification title is required.');
    if (!message) throw new HttpError(400, 'Notification message is required.');

    const id = newId();
    const now = new Date().toISOString();
    const docData = {
      title,
      message,
      reference,
      recipient,
      priority,
      event,
      read: false,
      readBy: [],
      createdAt: now,
      updatedAt: now,
      createdBy: user.displayName || user.email,
      createdUid: user.uid
    };

    await db.collection('notificationOutbox').doc(id).set(docData);
    // The School notification is already saved; delivery failure must not undo it.
    try{await sendSchoolPush(recipient);}
    catch(error){console.error('School push delivery failed:',error instanceof Error?error.message:'Unknown error');}
    invalidateGeneralCache('notifications');
    return json({ok: true, id, notification: {id, ...docData}});
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const user = await operator(req, ['super_admin', 'admin', 'reviewer', 'agent']);
    const body = await req.json();
    const id = safeText(body.id, 64);
    if (!id) throw new HttpError(400, 'Notification ID is required.');

    const ref = db.collection('notificationOutbox').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Notification not found.');
    const data = snap.data() || {};
    if (!canReadNotice(user,data)) throw new HttpError(403,'Notification access denied.');

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString()
    };

    if (typeof body.read === 'boolean') {
      updates.read = body.read;
      const readBy = Array.isArray(data.readBy) ? [...data.readBy] : [];
      if (body.read && !readBy.includes(user.uid)) {
        readBy.push(user.uid);
      } else if (!body.read) {
        const idx = readBy.indexOf(user.uid);
        if (idx !== -1) readBy.splice(idx, 1);
      }
      updates.readBy = readBy;
    }

    // Admins and creator can edit notification content
    if (user.role === 'super_admin' || user.role === 'admin' || data.createdUid === user.uid) {
      if (typeof body.title === 'string' && body.title.trim()) {
        updates.title = safeText(body.title, 120);
      }
      if (typeof body.message === 'string' && body.message.trim()) {
        updates.message = safeText(body.message, 1000);
      }
      if (typeof body.priority === 'string' && ['info', 'important', 'urgent'].includes(body.priority)) {
        updates.priority = body.priority;
      }
    }

    await ref.update(updates);
    invalidateGeneralCache('notifications');
    return json({ok: true, notification: safeNotice({id, ...data, ...updates})});
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const user = await operator(req, ['super_admin', 'admin', 'reviewer', 'agent']);
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action');

    if (action === 'clear_read') {
      throw new HttpError(403,'Bulk deletion of shared notifications is disabled.');
    }

    if (!id) throw new HttpError(400, 'Notification ID is required.');
    const ref = db.collection('notificationOutbox').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, 'Notification not found.');
    const data = snap.data() || {};

    if (user.role !== 'super_admin' && user.role !== 'admin' && data.recipientUid !== user.uid && data.createdUid !== user.uid) {
      throw new HttpError(403, 'Permission denied to delete this notification.');
    }

    await ref.delete();
    invalidateGeneralCache('notifications');
    return json({ok: true, deletedId: id});
  } catch (e) {
    return fail(e);
  }
}
