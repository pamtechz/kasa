import 'server-only';
import {db} from '@/lib/firebase-admin';
import {HttpError} from '@/lib/errors';
import {newId} from '@/lib/security';

/** Only active School agents and active students can own a referral. An application reference is never an identity. */
export async function referralOwner(codeInput:string,applicantUid?:string|null):Promise<string>{
 const code=codeInput.trim().toUpperCase();
 if(!/^[A-Z0-9-]{5,40}$/.test(code))throw new HttpError(400,'Invalid referral code.');
 const found=await db.collection('profiles').where('agentCode','==',code).limit(2).get();
 if(found.size!==1)throw new HttpError(400,'Referral code is not unique or active. Contact KASA support.');
 const owner=found.docs[0];
 if(owner.data().active!==true||!['agent','student'].includes(String(owner.data().role)))
  throw new HttpError(400,'Referral code is not active.');
 if(applicantUid&&owner.id===applicantUid)throw new HttpError(400,'Self-referrals are not eligible.');
 return owner.id;
}

/** Atomic first assignment; does not change role or active status and never revives disabled accounts. */
export async function studentReferralCode(uid:string):Promise<string>{
 const ref=db.collection('profiles').doc(uid);
 const generated='KASA-STU-'+newId().replace(/-/g,'').slice(0,16).toUpperCase();
 const claim=db.collection('referralCodes').doc(generated);
 return db.runTransaction(async tx=>{
  const [profile,existingClaim]=await Promise.all([tx.get(ref),tx.get(claim)]);
  const data=profile.data();
  if(!profile.exists||data?.active!==true||data?.role!=='student')
   throw new HttpError(403,'Only active verified students can participate in referrals.');
  if(data.agentCode){
   const linked=await db.collection('profiles').where('agentCode','==',data.agentCode).limit(2).get();
   if(linked.size!==1||linked.docs[0].id!==uid)
    throw new HttpError(409,'Existing referral code requires administrator reconciliation.');
   return String(data.agentCode);
  }
  if(existingClaim.exists)throw new HttpError(409,'Referral code collision. Retry.');
  tx.create(claim,{ownerUid:uid,createdAt:new Date().toISOString(),role:'student'});
  tx.update(ref,{agentCode:generated,isStudent:true,updatedAt:new Date().toISOString()});
  return generated;
 });
}
