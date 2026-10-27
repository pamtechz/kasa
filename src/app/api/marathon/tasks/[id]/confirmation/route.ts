import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity} from '@/lib/marathon';
import {validMarathonTaskId} from '@/lib/marathon-assignment';
import {sameOrigin} from '@/lib/security';

export const runtime='nodejs';
const schema=z.object({status:z.enum(['done','not_done'])}).strict();
/** An assignee reports their own outcome; only an authorized editor can close the canonical checklist. */
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  const identity=await marathonIdentity(req);
  const {id}=await params;
  if(!validMarathonTaskId(id))throw new HttpError(400,'Invalid task ID.');
  const payload=schema.safeParse(await req.json());
  if(!payload.success)throw new HttpError(400,'Confirm whether your task is complete or still outstanding.');
  const ref=db.collection('marathonTasks').doc(id);
  const now=new Date().toISOString();
  const confirmation=await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)throw new HttpError(404,'Task not found.');
   const prior=snap.data()!;
   if(prior.archived||prior.status==='done')throw new HttpError(409,'Task has already been closed.');
   if(!Array.isArray(prior.assigneeUids)||!prior.assigneeUids.includes(identity.uid))
    throw new HttpError(403,'Only an assigned team member may confirm this task.');
   const previous=prior.confirmationByUid&&typeof prior.confirmationByUid==='object'?prior.confirmationByUid:{};
   const response={status:payload.data.status,respondedAt:now,respondedBy:identity.uid};
   tx.update(ref,{confirmationByUid:{...previous,[identity.uid]:response}});
   tx.create(db.collection('marathonAudit').doc(randomUUID()),{
    taskId:id,actor:identity.uid,at:now,action:'task.confirmed',changes:{status:response.status}
   });
   return response;
  });
  return json({ok:true,confirmation,message:confirmation.status==='done'?'Completion reported to the team; an editor must verify and close the checklist action.':'Task remains open. The next reminder will follow its schedule.'});
 }catch(error){return fail(error);}
}
