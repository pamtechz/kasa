import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
export const runtime='nodejs';
const patch=z.object({
 expectedRevision:z.number().int().min(1),
 mutationId:z.string().uuid(),
 changes:z.object({
  title:z.string().trim().min(3).max(220).optional(),
  lead:z.string().trim().min(1).max(100).optional(),
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
  if(!/^(T\d{3}|WEB-\d{2}|M-[0-9a-f-]{36})$/.test(id))throw new HttpError(400,'Invalid action ID.');
  const parsed=patch.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,'Invalid changes or revision.');
  const {expectedRevision,mutationId,changes}=parsed.data;
  if(changes.completedAt && Date.parse(changes.completedAt)>Date.now()+5*60*1000)
    throw new HttpError(400,'Completion time cannot be in the future.');
  const ref=db.collection('marathonTasks').doc(id);
  const event=db.collection('marathonAudit').doc(mutationId);
  const now=new Date().toISOString();
  let updated:Record<string,unknown>|null=null;
  await db.runTransaction(async tx=>{
   const [prior,seen]=await Promise.all([tx.get(ref),tx.get(event)]);
   if(seen.exists){updated=null;return;}
   if(!prior.exists)throw new HttpError(404,'Action not found. Import checklist first.');
   const before=prior.data()!;
   if(Number(before.revision)!==expectedRevision)
    throw new HttpError(409,'This action was changed elsewhere. Refresh and review the latest version before retrying.');
   const next={...changes,revision:expectedRevision+1,updatedAt:now,updatedBy:identity.uid} as Record<string,unknown>;
   const finalStatus=changes.status||before.status;
   if(finalStatus==='done'){
    next.completedAt=changes.completedAt||before.completedAt||now;
    next.completedBy=identity.uid;
    next.recordedAt=now;
   }else if(changes.status&&changes.status!=='done'){
    next.completedAt=null;next.completedBy=null;next.recordedAt=now;
   }else if(changes.completedAt!==undefined){
    throw new HttpError(400,'Completion date requires Done status.');
   }
   tx.update(ref,next);
   tx.create(event,{taskId:id,action:'updated',actor:identity.uid,at:now,
    mutationId,before:{status:before.status,completedAt:before.completedAt||null,revision:before.revision},
    changes:next});
   updated={id,...before,...next};
  });
  if(!updated){const latest=await ref.get();updated={id,...latest.data()};}
  return json({task:updated});
 }catch(e){return fail(e);}
}
