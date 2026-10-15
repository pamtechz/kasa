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
  const result=await db.collection('submissions').where('applicantUid','==',user.uid).limit(100).get();
  return json({email:user.email,applications:result.docs.map(d=>{
   const x=d.data();return {id:d.id,reference:x.reference,formTitle:x.formTitle,submittedAt:x.submittedAt,status:x.status,fundingMethod:x.fundingMethod||null};
  }).sort((a,b)=>String(b.submittedAt).localeCompare(String(a.submittedAt)))});
 }catch(e){return fail(e);}
}
export async function POST(req:NextRequest){
 try{
  sameOrigin(req);await requireAppCheck(req);await rateLimit(req,'student-claim',6,15);
  const user=await verifiedUser(req),body=await req.json();
  const reference=String(body?.reference||'').trim().toUpperCase();
  if(!/^KASA-\d{4}-[A-F0-9]{8}$/.test(reference))throw new HttpError(400,'Enter a valid KASA application reference.');
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
   if(record.applicantUid&&record.applicantUid!==user.uid)throw new HttpError(409,'This application is linked to another verified account.');
   if(!record.applicantUid)tx.update(doc.ref,{applicantUid:user.uid,accountLinkedAt:new Date().toISOString()});
  });
  return json({ok:true});
 }catch(e){return fail(e);}
}
