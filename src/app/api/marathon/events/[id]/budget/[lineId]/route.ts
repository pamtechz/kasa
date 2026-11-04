import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
import {getMarathonEvent,requireBudgetAccess} from '@/lib/marathon-event-server';
import {calculatedLineMinor,canTransitionBudgetStatus,dateWithinEvent,taskEventId,type BudgetLine} from '@/lib/marathon-event-model';
export const runtime='nodejs';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const patch=z.object({expectedRevision:z.number().int().min(1),
 changes:z.object({
  category:z.string().trim().min(2).max(100).optional(),description:z.string().trim().min(3).max(250).optional(),
  quantity:z.number().int().min(1).max(1000000).optional(),unitCostMinor:z.number().int().min(0).max(1000000000).optional(),
  months:z.number().int().min(1).max(60).optional(),taskId:z.string().max(80).nullable().optional(),
  startDate:date.optional(),endDate:date.optional(),notes:z.string().max(2500).optional(),
  actualPaidMinor:z.number().int().min(0).max(100000000000).optional(),
  status:z.enum(['draft','submitted','approved','committed','paid','void']).optional()
 }).strict().refine(x=>Object.keys(x).length>0)
});
export async function PATCH(req:Request,{params}:{params:Promise<{id:string;lineId:string}>}){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req),{id,lineId}=await params,event=await getMarathonEvent(id);
  if(['completed','archived','cancelled'].includes(event.status))throw new HttpError(409,'Reopen the event before modifying its budget.');
  if(!/^(line-[0-9a-f-]{36}|seed-\d{3}|working-\d{3})$/.test(lineId))throw new HttpError(400,'Invalid budget line.');
  const parsed=patch.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,'Invalid budget changes or revision.');
  const data=parsed.data;
  // A separately assigned approver can approve or record payments without broad editing rights.
  const changed=Object.keys(data.changes);
  const approvalStatus=data.changes.status&&['approved','committed','paid','void'].includes(data.changes.status);
  if(approvalStatus||data.changes.actualPaidMinor!==undefined)requireBudgetAccess(actor,event,'approve');
  if(changed.some(key=>key!=='status'&&key!=='actualPaidMinor')||
     (data.changes.status!==undefined&&!approvalStatus&&data.changes.status!=='draft'))
   requireBudgetAccess(actor,event,'write');
  const taskId=data.changes.taskId;
  if(taskId){
   const task=await db.collection('marathonTasks').doc(taskId).get();
   if(!task.exists||taskEventId(task.data()||{})!==id)throw new HttpError(400,'Linked activity belongs to another event.');
  }
  const ref=db.collection('marathonEvents').doc(id).collection('budgetLines').doc(lineId);
  const audit=db.collection('marathonAudit').doc(),now=new Date().toISOString();
  let line:BudgetLine|undefined;
  await db.runTransaction(async tx=>{
   const doc=await tx.get(ref);
   if(!doc.exists)throw new HttpError(404,'Budget line not found.');
   const previous=doc.data() as BudgetLine;
   if(previous.revision!==data.expectedRevision)throw new HttpError(409,'This budget line changed elsewhere. Reload before editing.');
   const contentChanged=changed.some(k=>k!=='status'&&k!=='actualPaidMinor');
   if(['approved','committed','paid'].includes(previous.status)&&contentChanged)
    throw new HttpError(409,'Approved budget details are locked. An approver must return this line to draft before editing.');
   if(previous.status==='submitted'&&contentChanged)
    throw new HttpError(409,'Return the submitted line to draft before changing its details.');
   if(data.changes.status==='draft'){
    if(['approved','committed','paid','void'].includes(previous.status))
     requireBudgetAccess(actor,event,'approve');
    else requireBudgetAccess(actor,event,'write');
   }
   if(previous.status==='void'&&contentChanged)throw new HttpError(409,'Restore the void line to draft before editing.');
   if(data.changes.status&&!canTransitionBudgetStatus(previous.status,data.changes.status))
    throw new HttpError(409,'Invalid budget status change. Follow the draft, submit, approval and payment workflow.');
   const next={...previous,...data.changes,revision:previous.revision+1,updatedBy:actor.uid,updatedAt:now};
   if(!dateWithinEvent(next.startDate,event)||!dateWithinEvent(next.endDate,event)||next.startDate&&next.endDate&&next.startDate>next.endDate)
    throw new HttpError(400,'Budget dates must be within the event window.');
   try{next.plannedMinor=calculatedLineMinor(next.quantity,next.unitCostMinor,next.months);}
   catch{throw new HttpError(400,'Budget amount exceeds the supported limit.');}
   if(previous.sourceClassification&&contentChanged&&next.plannedMinor>0)
    next.sourceClassification='costed';
   if(next.actualPaidMinor>0&&!['approved','committed','paid'].includes(next.status))
    throw new HttpError(400,'A payment requires an approved budget line.');
   if(next.actualPaidMinor>next.plannedMinor)
    throw new HttpError(400,'Recorded payments cannot exceed this line budget. Approve a revised allocation first.');
   if(next.status==='paid'&&next.actualPaidMinor===0)throw new HttpError(400,'Enter the actual amount paid before marking as paid.');
   if(data.changes.status&&['approved','committed','paid'].includes(data.changes.status)){
    next.approvedBy=actor.uid;next.approvedAt=now;
   }
   tx.update(ref,next);
   tx.create(audit,{eventId:id,budgetLineId:lineId,action:'budget.line.updated',
    at:now,actor:actor.uid,before:{revision:previous.revision,status:previous.status,plannedMinor:previous.plannedMinor,actualPaidMinor:previous.actualPaidMinor},
    changes:data.changes});
   line=next;
  });
  return json({line});
 }catch(error){return fail(error);}
}
