import {NextResponse} from 'next/server';
import {isFirebaseReady} from '@/lib/readiness';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** Public health endpoint. Never disclose credentials or project identifiers. */
export async function GET(){
 const ready=isFirebaseReady();
 return NextResponse.json({service:'KASA Enrollment Network',status:ready?'ready':'configuration_required',acceptingApplications:ready},{status:200,headers:{'Cache-Control':'no-store'}});
}
