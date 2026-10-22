import {adminAuth,db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import type {Profile,Role} from '@/lib/types';

export const runtime='nodejs';

const allowedRoles:readonly Role[]=['super_admin','admin','reviewer','finance','agent','student'];

export async function GET(req:Request){
 try{
  const header=req.headers.get('authorization')||'';
  if(!header.startsWith('Bearer '))throw new HttpError(401,'Authentication required.');
  let token;
  try{token=await adminAuth.verifyIdToken(header.slice(7),true);}
  catch{throw new HttpError(401,'Your session has expired. Sign in again.');}
  if(!token.email_verified||!token.email)throw new HttpError(403,'Verify your email to access the portal.');
  const snapshot=await db.collection('profiles').doc(token.uid).get();
  if(snapshot.exists){
   const data=snapshot.data() as Profile;
   if(data.active!==true)throw new HttpError(403,'This account is inactive.');
   if(!allowedRoles.includes(data.role))throw new HttpError(403,'Unknown account role.');
   return json({profile:{...data,uid:token.uid,mustChangePassword:Boolean(data.mustChangePassword)}});
  }
  // New verified identities have student access only until separately provisioned.
  return json({profile:{
   uid:token.uid,email:token.email,
   displayName:token.name||token.email.split('@')[0],
   role:'student',active:true,mustChangePassword:false
  }});
 }catch(error){return fail(error);}
}
