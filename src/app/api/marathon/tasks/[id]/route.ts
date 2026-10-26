import {z} from 'zod';
import {sendMarathonPush} from '@/lib/mobile-push';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
import {completionChanges,preserveSourceCategory} from '@/lib/marathon-task-update';
import {isMarathonCategorySection} from '@/lib/marathon-categories';
import type {MarathonTask} from '@/lib/marathon-types';
export const runtime='nodejs';
function validId(id:string){return /^(T\d{3}|WEB-\d{2}|M-[0-9a-f-]{36})$/.test(id);}
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  await marathonIdentity(req);
  const {id}=await params;
  if(!validId(id))throw new HttpError(400,'Invalid action ID.');
  const snap=await db.collection('marathonTasks').doc(id).get();
  if(!snap.exists)throw new HttpError(404,'Action not found.');
  return json({task:{...snap.data(),id}});
 }catch(e){return fail(e);}
}
const patch=z.object({
 expectedRevision:z.number().int().min(1),
 mutationId:z.string().uuid(),
 changes:z.object({
  title:z.string().trim().min(3).max(220).optional(),
  lead:z.string().trim().min(1).max(100).optional(),
  section:z.string().refine(isMarathonCategorySection,'Choose a checklist category.').optional(),
  dueDate:z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.null()]).optional(),
  priority:z.enum(['P1 Act now','P2 Next 30 days','P3 Schedule']).optional(),
  importance:z.enum(['Critical','High','Medium','Low']).optional(),
  status:z.enum(['todo','doing','blocked','done']).optional(),
  completedAt:z.union([z.string().datetime({offset:true}),z.null()]).optional(),
  nextStep:z.string().max(1000).optional(),
  evidence:z.string().max(2000).optional(),
  notes:z.string().max(3000).optional(),
  archived:z.boolean().optional()
 }).strict().refine(x=>Object.keys(x).length>0)
});
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  const identity=await marathonIdentity(req);requireMarathon(identity,'edit');
  const {id}=await params;
  if(!validId(id))throw new HttpError(400,'Invalid action ID.');
  const parsed=patch.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,'Invalid changes or revision.');
  const {expectedRevision,mutationId,changes}=parsed.data;
  if(changes.completedAt && Date.parse(changes.completedAt)>Date.now()+5*60*1000)
    throw new HttpError(400,'Completion time cannot be in the future.');
  const ref=db.collection('marathonTasks').doc(id);
  const event=db.collection('marathonAudit').doc(mutationId);
  const now=new Date().toISOString();
  let updated:Record<string,unknown>|null=null;
  let appliedRevision=0;
  await db.runTransaction(async tx=>{
   const [prior,seen]=await Promise.all([tx.get(ref),tx.get(event)]);
   if(seen.exists){
    const recorded=seen.data()!;
    if(recorded.actor!==identity.uid||recorded.taskId!==id)throw new HttpError(409,'Mutation ID belongs to another update.');
    appliedRevision=Number(recorded.changes?.revision);
    updated=null;return;
   }
   if(!prior.exists)throw new HttpError(404,'Action not found. Import checklist first.');
   const before=prior.data()!;
   if(Number(before.revision)!==expectedRevision)
    throw new HttpError(409,'This action was changed elsewhere. Refresh and review the latest version before retrying.');
   const next={...changes,revision:expectedRevision+1,updatedAt:now,updatedBy:identity.uid} as Record<string,unknown>;
   Object.assign(next,preserveSourceCategory(before,changes));
   try{Object.assign(next,completionChanges(before as MarathonTask,changes,identity.uid,now));}
   catch{throw new HttpError(400,'Completion date requires Done status.');}
   appliedRevision=expectedRevision+1;
   tx.update(ref,next);
   tx.create(event,{taskId:id,action:'updated',actor:identity.uid,at:now,
    mutationId,before:{status:before.status,completedAt:before.completedAt||null,revision:before.revision,section:typeof before.section==='string'?before.section:null},
    changes:next});
   updated={id,...before,...next};
  });
  const newMutation=Boolean(updated);
  if(!updated){const latest=await ref.get();updated={id,...latest.data()};}
  if(newMutation&&(changes.status==='blocked'||changes.priority==='P1 Act now')){
   try{await sendMarathonPush('KASA Life Marathon — action requires attention','A checklist action has been marked blocked or high priority.');}
   catch(error){console.error('Marathon push delivery failed after task update',error instanceof Error?error.message:'Unknown delivery error');}
  }
  return json({task:updated,appliedRevision});
 }catch(e){return fail(e);}
}
