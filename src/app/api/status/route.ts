import {NextResponse} from 'next/server';
import {isFirebaseConfigured,isFirebaseReady} from '@/lib/readiness';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const configured=isFirebaseConfigured(),open=isFirebaseReady();
 return NextResponse.json({
  service:'KASA Enrollment Network',
  status:!configured?'configuration_required':open?'ready':'paused',
  configurationReady:configured,
  acceptingApplications:open
 },{status:200,headers:{'Cache-Control':'no-store'}});
}
