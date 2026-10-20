import {db} from '@/lib/firebase-admin';
import {operator, newId, safeText, sameOrigin} from '@/lib/security';
import {fail, json, HttpError} from '@/lib/errors';
import {getGeneralCache, setGeneralCache, invalidateGeneralCache} from '@/lib/server-cache';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const user = await operator(req, ['super_admin', 'admin', 'reviewer', 'agent']);
    const cacheKey = `notifications-${user.role}-${user.role === 'agent' ? user.uid : 'all'}`;
    const cached = getGeneralCache<{notifications: any[]}>(cacheKey);
    if (cached) return json(cached);

    const items = await db.collection('notificationOutbox').limit(300).get();
    const notifications = items.docs
      .map(d => ({id: d.id, ...d.data()}))
      .filter((x: any) => {
        if (user.role === 'agent') return x.recipient === 'all' || (x.recipient === 'agent' && (!x.recipientUid || x.recipientUid === user.uid));
        if (user.role === 'reviewer') return x.recipient === 'all' || x.recipient === 'reviewer' || x.recipient === 'admin';
        return true;
      })
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
    return json({ok: true, notification: {id, ...data, ...updates}});
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
      const snap = await db.collection('notificationOutbox').where('read', '==', true).limit(100).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      invalidateGeneralCache('notifications');
      return json({ok: true, cleared: snap.size});
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
