import 'server-only';
import {timingSafeEqual} from 'node:crypto';
import {adminAuth,db} from '@/lib/firebase-admin';
import {HttpError} from '@/lib/errors';

type SubmissionDocument = {downloadToken?: unknown;applicantUid?: unknown};

function validLegacyDownloadToken(supplied:string|null,expected:unknown):boolean {
  if (!supplied || typeof expected !== 'string' || expected.length !== 64) return false;
  // The existing application flow issues an opaque 64-character token. Retain
  // it temporarily for applicants without an account, but compare in constant time.
  if (!/^[a-f0-9]{64}$/i.test(supplied) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  return timingSafeEqual(Buffer.from(supplied.toLowerCase(),'hex'),Buffer.from(expected.toLowerCase(),'hex'));
}

/** Authorize a PDF/ID read with an existing single-application token or a verified Firebase identity. */
export async function authorizeSubmissionDocument(req:Request,record:SubmissionDocument):Promise<void>{
  const accessToken=new URL(req.url).searchParams.get('token');
  if(validLegacyDownloadToken(accessToken,record.downloadToken)) return;

  const header=req.headers.get('authorization')||'';
  if(!header.startsWith('Bearer ')) throw new HttpError(403,'A valid application download token or sign-in is required.');
  const jwt=header.slice(7).trim();
  let identity;
  try {identity=await adminAuth.verifyIdToken(jwt,true);}
  catch {throw new HttpError(401,'The sign-in session is invalid or expired.');}
  if(!identity.email_verified)throw new HttpError(403,'Verify your email before downloading documents.');

  if(typeof record.applicantUid==='string' && record.applicantUid===identity.uid) return;
  const profile=await db.collection('profiles').doc(identity.uid).get();
  if(profile.data()?.active===true && ['super_admin','admin','reviewer'].includes(String(profile.data()?.role))) return;
  throw new HttpError(403,'You cannot access documents for another application.');
}
