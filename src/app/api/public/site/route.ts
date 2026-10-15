import {NextResponse} from 'next/server';
import {isFirebaseConfigured} from '@/lib/readiness';
import {defaultSite,sanitizeSite} from '@/lib/site';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 let site=defaultSite;
 if(isFirebaseConfigured()){
  try{
   const {db}=await import('@/lib/firebase-admin');
   const snapshot=await db.collection('settings').doc('site').get();
   if(snapshot.exists)site=sanitizeSite(snapshot.data()?.content);
  }catch{/* Public website remains readable during maintenance. */}
 }
 return NextResponse.json({site},{headers:{'Cache-Control':'no-store'}});
}
