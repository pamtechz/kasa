import {randomUUID} from 'node:crypto';
import {after} from 'next/server';
import {sendMarathonPush} from '@/lib/mobile-push';
import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
import {isMarathonCategorySection} from '@/lib/marathon-categories';
export const runtime='nodejs';
const create=z.object({
 title:z.string().trim().min(3).max(220),
 lead:z.string().trim().min(2).max(100),
 section:z.string().refine(isMarathonCategorySection,'Choose a checklist category.'),
 dueDate:z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.null()]).default(null),
 priority:z.enum(['P1 Act now','P2 Next 30 days','P3 Schedule']).default('P2 Next 30 days'),
 importance:z.enum(['Critical','High','Medium','Low']).default('High'),
 nextStep:z.string().max(800).default(''),
 notes:z.string().max(3000).default('')
});
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const identity=await marathonIdentity(req);requireMarathon(identity,'edit');
  const parsed=create.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,parsed.error.issues.some(issue=>issue.path[0]==='section')?'Choose a checklist category. Refresh the workspace if the category field is unavailable.':'Check the action title, owner and due date.');
  const id='M-'+randomUUID();
  const now=new Date().toISOString();
  const task={...parsed.data,id,urgency:'New action',status:'todo',dependencies:[],
   dateBasis:'Team entry',sourceDeadline:'',cadence:'Once',origin:'Added in Marathon workspace',
   completedAt:null,revision:1,updatedAt:now,updatedBy:identity.uid,archived:false};
  const batch=db.batch();
  batch.create(db.collection('marathonTasks').doc(id),task);
  batch.create(db.collection('marathonAudit').doc(),{taskId:id,action:'created',at:now,actor:identity.uid,changes:parsed.data});
  await batch.commit();
  if(task.priority==='P1 Act now'){
   after(async()=>{try{await sendMarathonPush('KASA Life Marathon — urgent action','A new high-priority checklist action needs attention.');}
    catch(error){console.error('Marathon push delivery failed after task creation',error instanceof Error?error.message:'Unknown delivery error');}});
  }
  return json({task},201);
 }catch(e){return fail(e);}
}
