import {timingSafeEqual} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {adminAuth,db} from '@/lib/firebase-admin';
import {rateLimit,sameOrigin,requireAppCheck} from '@/lib/security';
import {fail,HttpError,json} from '@/lib/errors';
export const runtime='nodejs';

async function verifiedUser(req:Request){
 const h=req.headers.get('authorization')||'';
 if(!h.startsWith('Bearer '))throw new HttpError(401,'Sign in to see your application records.');
 let token;
 try{token=await adminAuth.verifyIdToken(h.slice(7),true);}catch{throw new HttpError(401,'Your session has expired.');}
 if(!token.email_verified||!token.email)throw new HttpError(403,'Verify your email to access applications.');
 return token;
}

export async function GET(req:Request){
 try{
  const user=await verifiedUser(req);
  // Only explicitly linked account records can be listed. Matching an email
  // supplied on an anonymous form is not sufficient proof of ownership.
  const uidQuery=await db.collection('submissions').where('applicantUid','==',user.uid).limit(100).get();
  const map=new Map<string, Record<string, unknown>>();
  uidQuery.docs.forEach(doc=>map.set(doc.id,{id:doc.id,...doc.data()}));

  const applications = Array.from(map.values()).map(x => ({
   id: x.id,
   reference: x.reference,
   formTitle: x.formTitle,
   submittedAt: x.submittedAt,
   status: x.status,
   fundingMethod: x.fundingMethod || null,
   downloadToken: x.downloadToken || null,
   letterUrl: ['accepted','letter_issued','cdf_submitted','cdf_approved','payment_verified','commission_paid'].includes(String(x.status)) && x.downloadToken ? `/api/public/submissions/${x.id}/letter?token=${x.downloadToken}` : null,
   enrollmentFormUrl: x.downloadToken ? `/api/public/submissions/${x.id}/enrollment-form?token=${x.downloadToken}` : null
  })).sort((a,b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));

  return json({ email: user.email, applications });
 }catch(e){return fail(e);}
}

export async function POST(req:NextRequest){
 try{
  sameOrigin(req);await requireAppCheck(req);await rateLimit(req,'student-claim',6,15);
  const user=await verifiedUser(req),body=await req.json();
  const reference=String(body?.reference||'').trim().toUpperCase();
  const downloadToken=String(body?.downloadToken||'').trim().toLowerCase();
  if(!/^KASA-\d{4}-[A-F0-9]{8}$/.test(reference))throw new HttpError(400,'Enter a valid KASA application reference.');
  if(!/^[a-f0-9]{64}$/.test(downloadToken))throw new HttpError(400,'Provide the private 64-character application token.');
  const result=await db.collection('submissions').where('reference','==',reference).limit(1).get();
  if(result.empty)throw new HttpError(404,'No matching application was found for the verified email.');
  const doc=result.docs[0];
  await db.runTransaction(async tx=>{
   const snapshot=await tx.get(doc.ref);
   const record=snapshot.data();
   if(!record)throw new HttpError(404,'Application not found.');
   const emailField=record.formSnapshot?.sections?.flatMap((s:{fields:{id:string;type:string}[]})=>s.fields).find((f:{type:string})=>f.type==='email');
   const email=emailField?String(record.answers?.[emailField.id]||'').trim().toLowerCase():'';
   if(email!==user.email?.toLowerCase())throw new HttpError(404,'No matching application was found for the verified email.');
   // Reference numbers and matching email addresses are public/guessable.
   // The opaque per-application token proves possession of the original receipt.
   const expected=String(record.downloadToken||'').toLowerCase();
   if(!/^[a-f0-9]{64}$/.test(expected) ||
      !timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(downloadToken,'hex'))) {
    throw new HttpError(404,'This application could not be linked with the supplied credentials.');
   }
   if(record.applicantUid&&record.applicantUid!==user.uid)throw new HttpError(409,'This application is linked to another verified account.');
   if(!record.applicantUid)tx.update(doc.ref,{applicantUid:user.uid,accountLinkedAt:new Date().toISOString()});
  });
  return json({ok:true});
 }catch(e){return fail(e);}
}

export async function PATCH(req:Request){
 try{
  sameOrigin(req);
  const user=await verifiedUser(req);
  const body=await req.json();
  const id=String(body.id||'').trim();
  if(!id)throw new HttpError(400,'Application ID required.');

  const docRef=db.collection('submissions').doc(id);
  const snap=await docRef.get();
  if(!snap.exists)throw new HttpError(404,'Application not found.');
  const record=snap.data();
  if(record?.applicantUid!==user.uid){
   throw new HttpError(403,'You can only update your own applications.');
  }
  if(!['submitted','under_review','needs_information'].includes(String(record?.status))){
   throw new HttpError(400,'Applications already approved or processed cannot be edited online.');
  }

  const answers=record?.answers||{};
  if(typeof body.phone==='string'&&body.phone.trim()){
   answers.phone=body.phone.trim();
  }
  if(typeof body.applicantNote==='string'){
   answers.applicantNote=body.applicantNote.trim();
  }

  await docRef.update({
   answers,
   updatedAt:new Date().toISOString()
  });

  return json({ok:true,id});
 }catch(e){return fail(e);}
}

export async function DELETE(req:Request){
 try{
  sameOrigin(req);
  const user=await verifiedUser(req);
  const url=new URL(req.url);
  const id=url.searchParams.get('id');
  if(!id)throw new HttpError(400,'Application ID required.');
  const docRef=db.collection('submissions').doc(id);
  const snap=await docRef.get();
  if(!snap.exists)throw new HttpError(404,'Application not found.');
  const record=snap.data();
  if(record?.applicantUid!==user.uid)throw new HttpError(403,'You can only withdraw your own applications.');
  if(!['submitted','under_review','needs_information'].includes(String(record?.status))){
   throw new HttpError(400,'Applications that have already been accepted or processed cannot be cancelled online. Please contact admissions.');
  }
  await docRef.delete();
  return json({ok:true});
 }catch(e){return fail(e);}
}
