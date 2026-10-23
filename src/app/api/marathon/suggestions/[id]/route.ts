import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity,requireMarathon} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
export const runtime='nodejs';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req);requireMarathon(actor,'review');
  const parsed=z.object({decision:z.enum(['accepted','rejected']),note:z.string().max(1000).default('')}).safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,'Invalid recommendation decision.');
  const {id}=await params;const ref=db.collection('marathonSuggestions').doc(id);
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)throw new HttpError(404,'Recommendation not found.');
   if(snap.data()?.status!=='pending')throw new HttpError(409,'Recommendation already reviewed.');
   tx.update(ref,{status:parsed.data.decision,reviewNote:parsed.data.note,reviewedBy:actor.uid,reviewedAt:new Date().toISOString()});
  });
  // Approval records the decision, but does not silently mutate the checklist.
  return json({ok:true});
 }catch(e){return fail(e);}
}
