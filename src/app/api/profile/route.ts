import {adminAuth,db} from '@/lib/firebase-admin';
import {fail,HttpError,json} from '@/lib/errors';
import {audit,rateLimit,sameOrigin} from '@/lib/security';
import type {NextRequest} from 'next/server';
import type {Profile} from '@/lib/types';

export const runtime = 'nodejs';

async function authenticatedUser(req: Request) {
  const h = req.headers.get('authorization') || '';
  if (!h.startsWith('Bearer ')) throw new HttpError(401, 'Sign in to access your profile account.');
  let token;
  try {
    token = await adminAuth.verifyIdToken(h.slice(7), true);
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.');
  }
  if(token.email_verified!==true)throw new HttpError(403,'Verify your email before accessing your private profile.');
  return token;
}

function sanitizeText(value: unknown, maxLength = 300): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function isCloudinaryUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('https://res.cloudinary.com/') || url.startsWith('https://console.cloudinary.com/');
}

export async function GET(req: Request) {
  try {
    const user = await authenticatedUser(req);
    const profileRef = db.collection('profiles').doc(user.uid);
    const profileSnap = await profileRef.get();
    
    let profileData = profileSnap.data() as Profile | undefined;
    if(profileData && profileData.active!==true)
      throw new HttpError(403,'This account is disabled.');
    if (!profileData) {
      const isStudent = true;
      profileData = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.name || (user.email ? user.email.split('@')[0] : 'User'),
        role: 'student',
        active: true,
        isStudent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await profileRef.set(profileData, {merge: true});
    }

    let authRecord;
    try {
      authRecord = await adminAuth.getUser(user.uid);
    } catch {
      authRecord = null;
    }

    return json({
      profile: {
        ...profileData,
        uid: user.uid,
        email: user.email || profileData.email
      },
      authUser: {
        uid: user.uid,
        email: user.email || '',
        emailVerified: user.email_verified ?? false,
        creationTime: authRecord?.metadata.creationTime || null,
        lastSignInTime: authRecord?.metadata.lastSignInTime || null
      }
    });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    sameOrigin(req);
    await rateLimit(req, 'profile-update', 30, 10);
    const user = await authenticatedUser(req);
    if(user.email_verified!==true)throw new HttpError(403,'Verify your email before modifying your profile.');
    const existing=await db.collection('profiles').doc(user.uid).get();
    if(existing.exists&&existing.data()?.active!==true)
      throw new HttpError(403,'This account is disabled.');
    const body = await req.json().catch(() => ({}));

    const updates: Partial<Profile> = {
      updatedAt: new Date().toISOString()
    };

    if ('displayName' in body) {
      const name = sanitizeText(body.displayName, 100);
      if (!name) throw new HttpError(400, 'Display name cannot be blank.');
      updates.displayName = name;
    }

    if ('phone' in body) {
      updates.phone = sanitizeText(body.phone, 35);
    }

    if ('address' in body) {
      updates.address = sanitizeText(body.address, 300);
    }

    if ('district' in body) {
      updates.district = sanitizeText(body.district, 100);
    }

    if ('province' in body) {
      updates.province = sanitizeText(body.province, 100);
    }

    if ('constituency' in body) {
      updates.constituency = sanitizeText(body.constituency, 100);
    }

    if ('ward' in body) {
      updates.ward = sanitizeText(body.ward, 100);
    }

    if ('bio' in body) {
      updates.bio = sanitizeText(body.bio, 500);
    }

    if ('mustChangePassword' in body) {
      throw new HttpError(403,'Account security flags can only be managed through approved administrator workflows.');
    }

    if ('photoUrl' in body) {
      const photo = sanitizeText(body.photoUrl, 500);
      if (photo && !isCloudinaryUrl(photo)) {
        throw new HttpError(400, 'Profile photos must strictly be uploaded to Cloudinary (https://console.cloudinary.com/app).');
      }
      updates.photoUrl = photo;
    }

    if ('notifications' in body && typeof body.notifications === 'object' && body.notifications !== null) {
      updates.notifications = {
        emailAlerts: Boolean(body.notifications.emailAlerts ?? true),
        newsUpdates: Boolean(body.notifications.newsUpdates ?? true),
        smsAlerts: Boolean(body.notifications.smsAlerts ?? false)
      };
    }

    const profileRef = db.collection('profiles').doc(user.uid);
    await profileRef.set(updates, {merge: true});

    // Sync Auth Display Name and Photo URL if modified
    const authSync: {displayName?: string; photoURL?: string} = {};
    if (updates.displayName) authSync.displayName = updates.displayName;
    if (updates.photoUrl !== undefined) authSync.photoURL = updates.photoUrl || undefined;

    if (Object.keys(authSync).length > 0) {
      try {
        await adminAuth.updateUser(user.uid, authSync);
      } catch {
        // Continue if Auth sync fails due to permissions or mock
      }
    }

    await audit(user.uid, 'profile_updated', `profiles/${user.uid}`, {fields: Object.keys(updates)});

    const snap = await profileRef.get();
    const finalProfile = snap.data() as Profile;

    return json({
      ok: true,
      profile: {
        ...finalProfile,
        uid: user.uid
      }
    });
  } catch (e) {
    return fail(e);
  }
}
