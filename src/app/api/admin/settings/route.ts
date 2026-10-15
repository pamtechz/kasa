import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,audit,sameOrigin} from '@/lib/security';
export const runtime='nodejs';
export async function GET(req:Request){try{await operator(req,['super_admin','admin','reviewer']);
 const doc=await db.collection('settings').doc('operations').get();return json({settings:doc.data()||{commissionAmount:0,organization:'KASA'}});
}catch(e){return fail(e);}}
export async function PUT(req:Request){try{
 sameOrigin(req);const who=await operator(req,['super_admin','admin']);const body=await req.json();
 const amount=Number(body?.commissionAmount);
 if(!Number.isFinite(amount)||amount<0||amount>50000)throw new HttpError(400,'Commission must be between K0 and K50,000.');
 const minimumEnrollmentPayment=Number(body?.minimumEnrollmentPayment??0);
 if(!Number.isFinite(minimumEnrollmentPayment)||minimumEnrollmentPayment<0||minimumEnrollmentPayment>500000)throw new HttpError(400,'Invalid required enrollment payment threshold.');
 const paidAmount=Number(body?.commissionAmountPaid??amount);
 const cdfAmount=Number(body?.commissionAmountCdf??amount);
 if(![paidAmount,cdfAmount].every(n=>Number.isFinite(n)&&n>=0&&n<=50000))throw new HttpError(400,'Each commission rate must be between K0 and K50,000.');
 const referralsEnabled=body?.referralsEnabled!==false;
 const organization=typeof body.organization==='string'?body.organization.trim().slice(0,120):'KASA';
 const letter=body.acceptanceLetter;
 if(!letter||typeof letter!=='object'||['body','nameField','courseField','intakeField','signatory'].some(k=>typeof letter[k]!=='string'||letter[k].length>(k==='body'?3500:160)))throw new HttpError(400,'Valid acceptance-letter template and mappings are required.');
 await db.collection('settings').doc('operations').set({commissionAmount:amount,commissionAmountPaid:paidAmount,commissionAmountCdf:cdfAmount,referralsEnabled,minimumEnrollmentPayment,organization,acceptanceLetter:{body:letter.body,nameField:letter.nameField,courseField:letter.courseField,intakeField:letter.intakeField,signatory:letter.signatory},updatedAt:new Date().toISOString()},{merge:true});
 await audit(who.uid,'settings.updated','operations',{commissionAmount:amount,commissionAmountPaid:paidAmount,commissionAmountCdf:cdfAmount,referralsEnabled});return json({ok:true});
}catch(e){return fail(e);}}
