import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,audit,safeText,sameOrigin} from '@/lib/security';
import type {SubmissionStatus} from '@/lib/types';
export const runtime='nodejs';
const stages:Record<SubmissionStatus,SubmissionStatus[]>={
 submitted:['under_review','needs_information','rejected'],
 under_review:['needs_information','accepted','rejected'],
 needs_information:['under_review','rejected'],
 accepted:['letter_issued','rejected'],
 letter_issued:['cdf_submitted','rejected'],
 cdf_submitted:['cdf_approved','rejected'],
 cdf_approved:['commission_paid'],
 commission_paid:[],rejected:[]
};
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);const user=await operator(req,['super_admin','admin','reviewer']);
  const {id}=await params;const body=await req.json();
  const status=body?.status as SubmissionStatus;
  if(!Object.hasOwn(stages,status))throw new HttpError(400,'Invalid status.');
  if(status==='cdf_approved'&&!(user.role==='super_admin'||user.role==='admin'))throw new HttpError(403,'Administrator approval is required.');
  if(status==='commission_paid'&&!(user.role==='super_admin'||user.role==='admin'))throw new HttpError(403,'Only administrators can register commission payments.');
  const ref=db.collection('submissions').doc(id);
  const settingsSnap=await db.collection('settings').doc('operations').get();
  const settings=settingsSnap.data()||{};
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);if(!snap.exists)throw new HttpError(404,'Application not found.');
   const old=snap.data()!;
   if(!stages[old.status as SubmissionStatus]?.includes(status))throw new HttpError(400,'Invalid status transition.');
   const now=new Date().toISOString();
   const changes:Record<string,unknown>={status,updatedAt:now,history:[...(old.history||[]).slice(-80),{status,at:now,by:user.uid}]};
   if(status==='cdf_approved'){
    const evidence=safeText(body?.cdfReference,160);
    if(evidence.length<5)throw new HttpError(400,'Record the official CDF approval reference.');
    changes.cdfVerification={reference:evidence,verifiedBy:user.uid,verifiedAt:now};
    if(old.agentId&&old.formKind==='student'){
     const amount=Number(settings.commissionAmount||0);
     if(!Number.isFinite(amount)||amount<=0)throw new HttpError(400,'Set a valid commission amount in Settings first.');
     if(body.referralVerified!==true)throw new HttpError(400,'Verify the agent referral evidence before reserving commission.');
     changes.referralVerified={by:user.uid,at:now};
     changes.commission={amount,currency:'ZMW'};
    }
   }
   if(status==='commission_paid'){
    if(!old.commission||!old.agentId)throw new HttpError(400,'No commission is payable for this application.');
    const evidence=safeText(body?.paymentReference,160);
    if(evidence.length<5)throw new HttpError(400,'Payment reference is required.');
    changes.commission={...old.commission,paidAt:now,paymentReference:evidence};
   }
   tx.update(ref,changes);
  });
  await audit(user.uid,'application.status_changed',id,{status});
  return json({ok:true});
 }catch(e){return fail(e);}
}
