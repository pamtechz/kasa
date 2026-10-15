import {loadIntake} from '@/lib/intake-server';
import {intakeWindow} from '@/lib/intake-policy';
import {fail,json} from '@/lib/errors';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const p=await loadIntake(),v=intakeWindow(p,'__public__');
  return json({open:v.open,reason:v.reason,opensAt:p.opensAt,closesAt:p.closesAt,notice:p.notice});
 }catch(e){return fail(e);}
}
