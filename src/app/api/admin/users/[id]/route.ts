import {adminAuth, db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {operator, safeText, sameOrigin, audit} from '@/lib/security';
import type {Profile} from '@/lib/types';

export const runtime = 'nodejs';

export async function PATCH(
  req: Request,
  {params}: {params: Promise<{id: string}>}
) {
  try {
    sameOrigin(req);
    const actor = await operator(req, ['super_admin', 'admin']);
    const {id: uid} = await params;
    const body = await req.json().catch(() => ({}));

    if (!uid) throw new HttpError(400, 'User ID is required.');

    const profileRef = db.collection('profiles').doc(uid);
    const snap = await profileRef.get();
    if (!snap.exists) throw new HttpError(404, 'User profile not found.');

    const currentData = snap.data() as Profile;

    // Super Admin protection
    if (currentData.role === 'super_admin' && actor.role !== 'super_admin') {
      throw new HttpError(403, 'Only Super Administrators can modify Super Admin accounts.');
    }

    const updates: Partial<Profile> & Record<string, unknown> = {
      updatedAt: new Date().toISOString()
    };

    const authUpdates: {
      displayName?: string;
      email?: string;
      emailVerified?: boolean;
      password?: string;
    } = {};

    // 1. Update Full Name
    if (typeof body.displayName === 'string') {
      const name = safeText(body.displayName, 120).trim();
      if (!name) throw new HttpError(400, 'Full name cannot be blank.');
      updates.displayName = name;
      authUpdates.displayName = name;
    }

    // 2. Update Email Address
    if (typeof body.email === 'string') {
      const email = safeText(body.email, 240).toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpError(400, 'Invalid email address format.');
      }
      updates.email = email;
      authUpdates.email = email;
      authUpdates.emailVerified = true;
    }

    // 3. Update Password
    if (typeof body.password === 'string' && body.password.trim().length > 0) {
      const pass = body.password.trim();
      if (pass.length < 8) {
        throw new HttpError(400, 'Password must be at least 8 characters long.');
      }
      authUpdates.password = pass;
    }

    // 4. Update Role
    if (typeof body.role === 'string' && ['student', 'agent', 'admin', 'reviewer'].includes(body.role)) {
      if (currentData.role === 'super_admin' && body.role !== 'super_admin') {
        throw new HttpError(403, 'Cannot demote Super Admin role.');
      }
      updates.role = body.role as any;
    }

    // 5. Update Contact & Territory Fields
    if ('phone' in body) updates.phone = safeText(body.phone, 40).trim() || undefined;
    if ('district' in body) updates.district = safeText(body.district, 100).trim() || undefined;
    if ('province' in body) updates.province = safeText(body.province, 100).trim() || undefined;
    if ('address' in body) updates.address = safeText(body.address, 300).trim() || undefined;
    if ('active' in body) updates.active = Boolean(body.active);
    if ('mustChangePassword' in body) updates.mustChangePassword = Boolean(body.mustChangePassword);

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
    const actor = await operator(req, ['super_admin', 'admin']);
    const {id: uid} = await params;

    if (!uid) throw new HttpError(400, 'User ID is required.');
    if (uid === actor.uid) throw new HttpError(403, 'Self-deletion of active administrator accounts is prohibited.');

    const profileRef = db.collection('profiles').doc(uid);
    const snap = await profileRef.get();
    if (!snap.exists) throw new HttpError(404, 'User profile not found.');

    const userData = snap.data() as Profile;

    if (userData.role === 'super_admin') {
      throw new HttpError(403, 'Super Admin accounts cannot be deleted.');
    }

    // 1. Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(uid);
    } catch (err) {
      console.warn(`Auth deletion warning for ${uid}:`, err);
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
