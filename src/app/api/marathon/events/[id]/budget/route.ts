import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
import {getMarathonEvent,requireBudgetAccess} from '@/lib/marathon-event-server';
import {budgetTotals,calculatedLineMinor,dateWithinEvent,taskEventId,type BudgetLine} from '@/lib/marathon-event-model';
export const runtime='nodejs';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const create=z.object({
 category:z.string().trim().min(2).max(100),description:z.string().trim().min(3).max(250),
 quantity:z.number().int().min(1).max(1000000),unitCostMinor:z.number().int().min(0).max(1000000000),
 months:z.number().int().min(1).max(60).default(1),
 taskId:z.string().max(80).nullable().default(null),startDate:date.default(null),endDate:date.default(null),
 notes:z.string().max(2500).default('')
}).strict();
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const identity=await marathonIdentity(req),{id}=await params;
  const event=await getMarathonEvent(id);
  requireBudgetAccess(identity,event,'read');
  const snap=await db.collection('marathonEvents').doc(id).collection('budgetLines').limit(500).get();
  const lines=snap.docs.map(x=>({...x.data(),id:x.id} as BudgetLine)).sort((a,b)=>a.category.localeCompare(b.category)||a.description.localeCompare(b.description));
  const totals=budgetTotals(lines,event.targetRunners,event.registrationFeeMinor);
  const contingencyMinor=event.budgetContingencyAlreadyIncluded?0:Math.round(totals.plannedMinor/10);
  return json({event,lines,totals:{...totals,contingencyMinor,totalWithContingencyMinor:totals.plannedMinor+contingencyMinor},
   permissions:{write:identity.role==='super_admin'||((event.adminUids.includes(identity.uid)||event.budgetEditorUids.includes(identity.uid))&&identity.role!=='kasaClient'),
    approve:identity.role==='super_admin'||((event.adminUids.includes(identity.uid)||event.budgetApproverUids.includes(identity.uid))&&identity.role!=='kasaClient')}});
 }catch(error){return fail(error);}
}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);
  const actor=await marathonIdentity(req),{id}=await params,event=await getMarathonEvent(id);
  requireBudgetAccess(actor,event,'write');
  if(['completed','archived','cancelled'].includes(event.status))throw new HttpError(409,'Reopen the event before modifying its budget.');
  const parsed=create.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,'Check category, quantity, rate, dates and notes.');
  const data=parsed.data;
  if(!dateWithinEvent(data.startDate,event)||!dateWithinEvent(data.endDate,event)||data.startDate&&data.endDate&&data.startDate>data.endDate)
   throw new HttpError(400,'Budget activity dates must fall within the event preparation and closeout period.');
  if(data.taskId){
   const task=await db.collection('marathonTasks').doc(data.taskId).get();
   if(!task.exists||taskEventId(task.data()||{})!==id)throw new HttpError(400,'Linked checklist activity must belong to this event.');
  }
  let amount:number;
  try{amount=calculatedLineMinor(data.quantity,data.unitCostMinor,data.months);}
  catch{throw new HttpError(400,'Cost calculation exceeds allowed limits.');}
  const idLine='line-'+randomUUID(),now=new Date().toISOString();
  const line:BudgetLine={...data,id:idLine,eventId:id,plannedMinor:amount,actualPaidMinor:0,status:'draft',
   revision:1,createdBy:actor.uid,createdAt:now,updatedBy:actor.uid,updatedAt:now};
  const batch=db.batch();
  batch.create(db.collection('marathonEvents').doc(id).collection('budgetLines').doc(idLine),line);
  batch.create(db.collection('marathonAudit').doc(),{eventId:id,budgetLineId:idLine,action:'budget.line.created',at:now,actor:actor.uid,changes:data});
  await batch.commit();
  return json({line},201);
 }catch(error){return fail(error);}
}
