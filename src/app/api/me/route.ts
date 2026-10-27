import {adminAuth,db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator} from '@/lib/security';
import type {Profile} from '@/lib/types';
import {canUseUnverifiedProvisionedAccount} from '@/lib/provisioned-sign-in';

export const runtime='nodejs';

export async function GET(req:Request){
  try{
    try{
      const op = await operator(req,['super_admin','admin','reviewer','agent']);
      return json({profile: op});
    }catch(err){
      if(err instanceof HttpError && err.status === 403){
        const h = req.headers.get('authorization')||'';
        if(h.startsWith('Bearer ')){
          const token = await adminAuth.verifyIdToken(h.slice(7), true);
          const doc = await db.collection('profiles').doc(token.uid).get();
          if(doc.exists){
            const data = doc.data() as Profile;
            if(!data.active) throw new HttpError(403, 'Account is deactivated.');
            if(!token.email_verified&&!canUseUnverifiedProvisionedAccount(data,token.email))
             throw new HttpError(403,'Verify your email before accessing KASA. Check Inbox and Spam for your Firebase verification link.');
            return json({profile: {...data, uid: token.uid, role: data.role || 'student', mustChangePassword: Boolean(data.mustChangePassword)},emailVerified:Boolean(token.email_verified)});
          }
          if(!token.email_verified)throw new HttpError(403,'Verify your email before accessing KASA.');
          return json({
            profile: {
              uid: token.uid,
              email: token.email || '',
              displayName: token.name || (token.email ? token.email.split('@')[0] : 'Student'),
              role: 'student',
              active: true,
              mustChangePassword: false
            }
          });
        }
      }
      throw err;
    }
  }catch(e){
    return fail(e);
  }
}
