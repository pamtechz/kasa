import {NextResponse} from 'next/server';
import {isFirebaseConfigured} from '@/lib/readiness';
import {loadIntake} from '@/lib/intake-server';
import {intakeWindow} from '@/lib/intake-policy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 const configured=isFirebaseConfigured();
 if(!configured)return NextResponse.json({service:'KASA Enrollment Network',status:'configuration_required',acceptingApplications:false},{headers:{'Cache-Control':'no-store'}});
 try{
  const policy=await loadIntake(),state=intakeWindow(policy,'__public__');
  return NextResponse.json({service:'KASA Enrollment Network',status:state.open?'open':'closed',acceptingApplications:state.open,reason:state.reason},{headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({service:'KASA Enrollment Network',status:'firebase_unavailable',acceptingApplications:false},{headers:{'Cache-Control':'no-store'}});
 }
}
