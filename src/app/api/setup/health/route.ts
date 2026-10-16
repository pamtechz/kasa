import {NextResponse} from 'next/server';
import {isFirebaseConfigured} from '@/lib/readiness';
import {db} from '@/lib/firebase-admin';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/** A small, anonymous and deliberately non-sensitive connectivity probe. */
export async function GET(){
 if(!isFirebaseConfigured()){
  return NextResponse.json({state:'configuration_required',database:'unknown'},
   {headers:{'Cache-Control':'public, max-age=0, s-maxage=30'}});
 }
 try{
  // A genuine Firestore read: environment-variable checks alone do not prove connectivity.
  const bootstrap=await db.collection('settings').doc('bootstrap').get();
  return NextResponse.json({
   state:'connected',database:'reachable',
   initialized:bootstrap.exists
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error('KASA Firestore connectivity check failed',error instanceof Error?error.message:'unknown');
  return NextResponse.json({state:'unavailable',database:'unreachable'},
   {headers:{'Cache-Control':'no-store'}});
 }
}
