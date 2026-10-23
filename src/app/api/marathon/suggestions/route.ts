import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
import {marathonSuggestionsPage} from '@/lib/marathon-suggestions';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const actor=await marathonIdentity(req);
  const query=new URL(req.url).searchParams;
  return json(await marathonSuggestionsPage(actor,query.get('status')||'pending',query.get('cursor')));
 }catch(e){return fail(e);}
}
const schema=z.object({
 taskId:z.string().min(2).max(60),
 recommendation:z.string().trim().min(10).max(1500),
 proposedStatus:z.enum(['todo','doing','blocked','done']).optional(),
 proposedCompletedAt:z.union([z.string().datetime({offset:true}),z.null()]).optional()
});
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req);
  const parsed=schema.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,'Select an action and explain your recommendation.');
  const task=await db.collection('marathonTasks').doc(parsed.data.taskId).get();
  if(!task.exists)throw new HttpError(404,'Action not found.');
  const ref=db.collection('marathonSuggestions').doc();
  const record={...parsed.data,createdBy:actor.uid,createdName:actor.displayName,createdAt:new Date().toISOString(),status:'pending'};
  await ref.create(record);
  return json({suggestion:{id:ref.id,...record}},201);
 }catch(e){return fail(e);}
}
