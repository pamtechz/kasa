import {NextResponse} from 'next/server';
import {createPrivateKey} from 'node:crypto';
import {isFirebaseConfigured} from '@/lib/readiness';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function hasUsableServiceKey():boolean{
 try{
  const raw=process.env.FIREBASE_PRIVATE_KEY||'';
  const privateKey=raw.trim().replace(/^"|"$/g,'').replace(/\\n/g,'\n');
  return createPrivateKey({key:privateKey,format:'pem'}).asymmetricKeyType!==undefined;
 }catch{return false;}
}
export async function GET(){
 const configured=isFirebaseConfigured()&&hasUsableServiceKey();
 const open=configured&&process.env.KASA_APPLICATIONS_ENABLED==='true';
 return NextResponse.json({
  service:'KASA Enrollment Network',
  status:!configured?'configuration_required':open?'ready':'paused',
  configurationReady:configured,
  acceptingApplications:open
 },{status:200,headers:{'Cache-Control':'no-store'}});
}
