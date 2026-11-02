import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
import {getMarathonEvent,validEventId} from '@/lib/marathon-event-server';
export const runtime='nodejs';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const patch=z.object({
 expectedRevision:z.number().int().min(0),
 changes:z.object({
  name:z.string().trim().min(5).max(130).optional(),
  preparationStart:date.optional(),eventDate:date.optional(),closeoutDate:date.optional(),
  status:z.enum(['draft','planning','active','completed','archived','cancelled']).optional(),
  targetRunners:z.number().int().min(1).max(100000).optional(),
  registrationFeeMinor:z.number().int().min(0).max(10000000).optional(),
  adminUids:z.array(z.string().min(1)).max(100).optional(),
  budgetEditorUids:z.array(z.string().min(1)).max(100).optional(),
  budgetViewerUids:z.array(z.string().min(1)).max(100).optional(),
  budgetApproverUids:z.array(z.string().min(1)).max(100).optional()
 }).strict().refine(x=>Object.keys(x).length>0)
});
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{await marathonIdentity(req);const {id}=await params;return json({event:await getMarathonEvent(id)});}
 catch(error){return fail(error);}
}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req);
  if(actor.role!=='super_admin')throw new HttpError(403,'Only the KASA super administrator may change event settings or grant permissions.');
  const {id}=await params;
  if(!validEventId(id))throw new HttpError(400,'Invalid event.');
  const input=patch.safeParse(await req.json());
  if(!input.success)throw new HttpError(400,'Check event details and revision.');
  const ref=db.collection('marathonEvents').doc(id),audit=db.collection('marathonAudit').doc();
  const now=new Date().toISOString();let output:unknown;
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   const previous=snap.exists?{...snap.data(),id} as Awaited<ReturnType<typeof getMarathonEvent>>:await getMarathonEvent(id);
   if(Number(previous.revision)!==input.data.expectedRevision)throw new HttpError(409,'Event updated elsewhere. Refresh.');
   const next={...previous,...input.data.changes,revision:input.data.expectedRevision+1,updatedAt:now,updatedBy:actor.uid};
   if(next.preparationStart>next.eventDate||next.eventDate>next.closeoutDate)throw new HttpError(400,'Event dates are inconsistent.');
   for(const key of ['adminUids','budgetEditorUids','budgetViewerUids','budgetApproverUids'] as const)
    if(Array.isArray(next[key]))next[key]=[...new Set(next[key])];
   if(snap.exists)tx.update(ref,next);else tx.create(ref,next);
   tx.create(audit,{eventId:id,action:'event.updated',at:now,actor:actor.uid,changes:input.data.changes});
   output=next;
  });
  return json({event:output});
 }catch(error){return fail(error);}
}
