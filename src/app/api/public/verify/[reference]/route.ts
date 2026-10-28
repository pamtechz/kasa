import {NextRequest} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {fail, json, HttpError} from '@/lib/errors';
import {rateLimit} from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OFFER_STATES = [
  'accepted','letter_issued','cdf_submitted','cdf_approved','cdf_funds_received',
  'payment_verified','commission_paid'
];

export async function GET(req:NextRequest,{params}:{params:Promise<{reference:string}>}){
  try{
    await rateLimit(req,'public-offer-verification',12,15);
    const {reference} = await params;
    const cleanRef = String(reference || '').trim().toUpperCase();
    if(!/^KASA-[A-Z0-9-]{8,40}$/.test(cleanRef)){
      throw new HttpError(400,'Invalid official reference format.');
    }
    const snap=await db.collection('submissions')
      .where('reference','==',cleanRef).limit(1).get();
    const record=snap.docs[0]?.data();
    // Do not reveal whether the reference belongs to an applicant awaiting
    // review, or show names, phone numbers, funding details, or current status.
    if(!record || record.formKind!=='student' ||
        !OFFER_STATES.includes(String(record.status))){
      return json({
        verified:false,
        reference:cleanRef,
        message:'No issued KASA admission offer can be verified for this reference.'
      },404);
    }
    return json({
      verified:true,
      reference:cleanRef,
      message:'An official KASA admission offer is recorded for this reference. Confirm the applicant identity directly with KASA Admissions.'
    });
  }catch(error){return fail(error);}
}
