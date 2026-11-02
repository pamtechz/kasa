import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/firebase-admin';
import {fail} from '@/lib/errors';
import {sameOrigin,requireAppCheck,rateLimit} from '@/lib/security';
import {GUEST_STORAGE_COOKIE,guestStorageId,guestStorageIdentity} from '@/lib/r2-guest';
export const runtime='nodejs';
/** An applicant can authorize personal storage without creating a KASA account. */
export async function POST(req:NextRequest){
 try{
  sameOrigin(req);await requireAppCheck(req);await rateLimit(req,'guest-storage',10,60);
  if(await guestStorageIdentity(req))return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  const secret=randomBytes(32).toString('base64url'),uid=guestStorageId(secret);
  const maxAge=7*24*60*60;
  await db.collection('r2GuestSessions').doc(uid).create({expiresAt:Date.now()+maxAge*1000,createdAt:new Date().toISOString()});
  const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(GUEST_STORAGE_COOKIE,secret,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge});
  return response;
 }catch(e){return fail(e);}
}
