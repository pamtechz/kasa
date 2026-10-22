import 'server-only';
import {adminAuth,db} from '@/lib/firebase-admin';
import {HttpError} from '@/lib/errors';

export async function verifiedStudent(req:Request){
 const h=req.headers.get('authorization')||'';
 if(!h.startsWith('Bearer '))throw new HttpError(401,'Sign in to use your KASA student account.');
 let token;
 try{token=await adminAuth.verifyIdToken(h.slice(7),true);}
 catch{throw new HttpError(401,'Your session has expired. Sign in again.');}
 if(!token.email_verified||!token.email)throw new HttpError(403,'Verify your email before accessing applications.');
 const profile=await db.collection('profiles').doc(token.uid).get();
 if(profile.exists){
  if(profile.data()?.active!==true)throw new HttpError(403,'Your student account is inactive.');
  if(profile.data()?.role!=='student')throw new HttpError(403,'This endpoint is for student accounts.');
 }
 return token;
}
