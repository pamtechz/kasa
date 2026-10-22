import {adminAuth, db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {requirePermission,safeText,sameOrigin,audit} from '@/lib/security';
import type {Profile} from '@/lib/types';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  {params}: {params: Promise<{id: string}>}
) {
  try {
    sameOrigin(req);
    const actor = await requirePermission(req,'users.manage');
    const {id: uid} = await params;
    const body = await req.json().catch(() => ({}));

    if (!uid) throw new HttpError(400, 'User ID is required.');

    const profileRef = db.collection('profiles').doc(uid);
    const snap = await profileRef.get();
    if (!snap.exists) throw new HttpError(404, 'User profile not found.');

    const currentData = snap.data() as Profile;

    // Super Admin protection
    const privilegedRoles = ['super_admin','admin','reviewer','finance'];
    if (privilegedRoles.includes(currentData.role) && actor.role !== 'super_admin') {
      throw new HttpError(403,'Only the Super Administrator can manage privileged accounts.');
    }
    if (uid === actor.uid &&
        ('role' in body || 'active' in body || 'email' in body)) {
      throw new HttpError(403,'You cannot change your own role, active status or verified email through this endpoint.');
    }

    const updates: Partial<Profile> & Record<string, unknown> = {
      updatedAt: new Date().toISOString()
    };

    const authUpdates: {displayName?: string} = {};

    // 1. Update Full Name
    if (typeof body.displayName === 'string') {
      const name = safeText(body.displayName, 120).trim();
      if (!name) throw new HttpError(400, 'Full name cannot be blank.');
      updates.displayName = name;
      authUpdates.displayName = name;
    }

    // Firebase Auth email verification must be completed by the owner using
    // an emailed verification link, never asserted by an administrator.
    if (body.email !== undefined) {
      if (typeof body.email !== 'string' ||
          body.email.trim().toLowerCase() !== String(currentData.email || '').toLowerCase()) {
        throw new HttpError(409,'Email changes require the verified account-recovery workflow.');
      }
    }
    if (body.password !== undefined) {
      throw new HttpError(403,'Password changes must use verified account recovery. Admin-assigned passwords are disabled.');
    }

    // 4. Update Role
    if (typeof body.role === 'string' && ['student', 'agent', 'admin', 'reviewer'].includes(body.role)) {
      if (currentData.role === 'super_admin' && body.role !== 'super_admin') {
        throw new HttpError(403, 'Cannot demote Super Admin role.');
      }
      if (body.role !== currentData.role) {
        if (actor.role !== 'super_admin') {
          throw new HttpError(403,'Only a Super Administrator can assign account roles.');
        }
        const authIdentity = await adminAuth.getUser(uid);
        if (!authIdentity.emailVerified) {
          throw new HttpError(403,'Verify the account email before changing roles.');
        }
        updates.role = body.role as any;
      }
    }

    // 5. Update Contact & Territory Fields
    if ('phone' in body) updates.phone = safeText(body.phone, 40).trim();
    if ('district' in body) updates.district = safeText(body.district, 100).trim();
    if ('province' in body) updates.province = safeText(body.province, 100).trim();
    if ('address' in body) updates.address = safeText(body.address, 300).trim();
    if ('active' in body) {
      if (typeof body.active !== 'boolean') throw new HttpError(400,'Invalid active status.');
      updates.active = body.active;
    }
    if ('mustChangePassword' in body &&
        Boolean(body.mustChangePassword) !== Boolean(currentData.mustChangePassword)) {
      if (actor.role !== 'super_admin') throw new HttpError(403,'Only a Super Administrator can set account security flags.');
      updates.mustChangePassword = Boolean(body.mustChangePassword);
    }

    // Apply Firebase Auth updates if name, email, or password were changed
    if (Object.keys(authUpdates).length > 0) {
      try {
        await adminAuth.updateUser(uid, authUpdates);
      } catch (err) {
        throw new HttpError(400, `Firebase Auth update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Apply Firestore Profile updates
    await profileRef.set(updates, {merge: true});

    await audit(actor.uid, 'user.updated_by_admin', uid, {
      updatedFields: Object.keys(updates),
      authUpdated: Object.keys(authUpdates)
    });

    const updatedSnap = await profileRef.get();
    return json({
      ok: true,
      profile: {id: uid, ...updatedSnap.data()},
      message: `User account (${updates.displayName || currentData.displayName}) updated successfully.`
    });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(
  req: Request,
  {params}: {params: Promise<{id: string}>}
) {
  try {
    sameOrigin(req);
    const actor = await requirePermission(req,'users.manage');
    const {id: uid} = await params;

    if (!uid) throw new HttpError(400, 'User ID is required.');
    if (uid === actor.uid) throw new HttpError(403, 'Self-deletion of active administrator accounts is prohibited.');

    const profileRef = db.collection('profiles').doc(uid);
    const snap = await profileRef.get();
    if (!snap.exists) throw new HttpError(404, 'User profile not found.');

    const userData = snap.data() as Profile;

    if (userData.role === 'super_admin') {
      throw new HttpError(403, 'Super Administrator accounts cannot be deleted.');
    }
    if (['admin','reviewer','finance'].includes(userData.role) &&
        actor.role !== 'super_admin') {
      throw new HttpError(403, 'Only a Super Administrator can delete staff accounts.');
    }

    // 1. Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(uid);
    } catch {
      // Preserve the Firestore profile if identity deletion did not succeed.
      // It must be reconciled rather than leave a live identity without its record.
      throw new HttpError(502,'Firebase Auth deletion failed. No profile was deleted.');
    }

    // 2. Delete Profile Document from Firestore
    await profileRef.delete();

    await audit(actor.uid, 'user.deleted_by_admin', uid, {
      email: userData.email,
      displayName: userData.displayName,
      role: userData.role
    });

    return json({
      ok: true,
      deletedUid: uid,
      message: `User account ${userData.displayName} (${userData.email}) deleted successfully.`
    });
  } catch (e) {
    return fail(e);
  }
}
