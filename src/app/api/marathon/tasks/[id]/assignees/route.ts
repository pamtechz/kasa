import {randomUUID} from 'node:crypto';
import {after} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity} from '@/lib/marathon';
import {canAssignMarathonTasks,validMarathonTaskId,validateMarathonAssignees} from '@/lib/marathon-assignment';
import {sendMarathonPush} from '@/lib/mobile-push';
import {sameOrigin} from '@/lib/security';

export const runtime='nodejs';
const schema=z.object({
 expectedRevision:z.number().int().min(1),
 assigneeUids:z.array(z.string().min(1).max(128)).max(20)
}).strict();

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req);
  if(!canAssignMarathonTasks(actor.role))throw new HttpError(403,'Only Marathon administrators and operations managers can assign members.');
  const {id}=await params;
  if(!validMarathonTaskId(id))throw new HttpError(400,'Invalid task ID.');
  const body=schema.safeParse(await req.json());
  if(!body.success)throw new HttpError(400,'Select valid members and refresh the latest task revision.');
  const assigneeUids=[...new Set(body.data.assigneeUids)];
  if(assigneeUids.length!==body.data.assigneeUids.length)throw new HttpError(400,'A member cannot be assigned twice.');
  await validateMarathonAssignees(assigneeUids);
  const now=new Date().toISOString();
  const ref=db.collection('marathonTasks').doc(id);
  let newAssignees:string[]=[];
  const task=await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)throw new HttpError(404,'Task not found.');
   const before=snap.data()!;
   if(Number(before.revision)!==body.data.expectedRevision)
    throw new HttpError(409,'Task changed. Refresh before saving assignments.');
   const previous=Array.isArray(before.assigneeUids)?before.assigneeUids.filter((x:unknown):x is string=>typeof x==='string'):[];
   newAssignees=assigneeUids.filter(uid=>!previous.includes(uid));
   const previousConfirmations=(before.confirmationByUid||{}) as Record<string,unknown>;
   const confirmationByUid=Object.fromEntries(assigneeUids.filter(uid=>previous.includes(uid)&&previousConfirmations[uid]).map(uid=>[uid,previousConfirmations[uid]]));
   const updates={assigneeUids,confirmationByUid,revision:body.data.expectedRevision+1,updatedAt:now,updatedBy:actor.uid};
   tx.update(ref,updates);
   tx.create(db.collection('marathonAudit').doc(randomUUID()),{
    taskId:id,actor:actor.uid,at:now,action:'task.assigned',before:{assigneeUids:previous},changes:{assigneeUids}
   });
   return {id,...before,...updates};
  });
  if(newAssignees.length){
   after(async()=>{
    for(const uid of newAssignees){
     try{await sendMarathonPush('KASA Life Marathon — task assigned','You have a new checklist assignment. Open Marathon to review and confirm its status.',
       '/marathon/operations?task='+encodeURIComponent(id),uid);}
     catch(error){console.error('Marathon assignment push failed',error instanceof Error?error.message:'Unknown delivery error');}
    }
   });
  }
  return json({task,notifiedMembers:newAssignees.length});
 }catch(error){return fail(error);}
}
