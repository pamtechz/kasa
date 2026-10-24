import seed from '@/data/marathon-seed.json';
import legacy from '@/data/marathon-seed-2026-10-23.json';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
import {previewChecklistImport,applyChecklistImport,ChecklistImportError} from '@/lib/marathon-seed-import';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const actor=await marathonIdentity(req);requireMarathon(actor,'super');
  return json(await previewChecklistImport(db,seed,legacy,actor.uid));
 }catch(e){return fail(e instanceof ChecklistImportError?new HttpError(e.status,e.message):e);}
}
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req);requireMarathon(actor,'super');
  const body=await req.json().catch(()=>null);
  if(body?.version!==seed.version||typeof body?.planHash!=='string'||!/^[0-9a-f]{64}$/.test(body.planHash))throw new HttpError(400,'Review the current checklist import before applying it.');
  return json({ok:true,...await applyChecklistImport(db,seed,legacy,actor.uid,body.planHash)});
 }catch(e){return fail(e instanceof ChecklistImportError?new HttpError(e.status,e.message):e);}
}
