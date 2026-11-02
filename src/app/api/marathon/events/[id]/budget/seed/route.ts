import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity} from '@/lib/marathon';
import {sameOrigin} from '@/lib/security';
import {getMarathonEvent} from '@/lib/marathon-event-server';
import {LEGACY_MARATHON_EVENT_ID,type BudgetLine} from '@/lib/marathon-event-model';
import {marathon2027BudgetDraft,marathon2027BudgetDraftTotalMinor} from '@/data/marathon-2027-budget';
export const runtime='nodejs';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);const actor=await marathonIdentity(req),{id}=await params;
  if(actor.role!=='super_admin')throw new HttpError(403,'Only super admin may import the approved draft.');
  if(id!==LEGACY_MARATHON_EVENT_ID)throw new HttpError(400,'This template applies only to the March 2027 event.');
  const event=await getMarathonEvent(id);
  const total=marathon2027BudgetDraft.reduce((n,line)=>n+line.quantity*line.unitCostMinor*line.months,0);
  if(total!==marathon2027BudgetDraftTotalMinor)throw new HttpError(500,'Source budget reconciliation failed.');
  const ref=db.collection('marathonEvents').doc(id);
  const priorLines=await ref.collection('budgetLines').limit(1).get();
  if(!priorLines.empty)throw new HttpError(409,'This event already has budget lines. Import is disabled to avoid duplicate allocations.');
  const now=new Date().toISOString();
  let imported=0;
  await db.runTransaction(async tx=>{
   const refs=marathon2027BudgetDraft.map(line=>ref.collection('budgetLines').doc(line.id));
   const docs=await Promise.all([tx.get(ref),...refs.map(x=>tx.get(x))]);
   if(docs.slice(1).some(x=>x.exists))throw new HttpError(409,'Budget already imported or modified. Import aborted to protect existing amounts.');
   if(!docs[0].exists)tx.create(ref,{...event,revision:1,createdAt:now,createdBy:actor.uid,updatedAt:now,updatedBy:actor.uid});
   for(let i=0;i<marathon2027BudgetDraft.length;i++){
    const item=marathon2027BudgetDraft[i];
    const line:BudgetLine={...item,eventId:id,status:'draft',plannedMinor:item.quantity*item.unitCostMinor*item.months,
     actualPaidMinor:0,taskId:null,startDate:null,endDate:null,notes:'Unverified planning allowance; supplier quotation required.',
     revision:1,createdBy:actor.uid,createdAt:now,updatedBy:actor.uid,updatedAt:now};
    tx.create(refs[i],line);imported++;
   }
   tx.create(db.collection('marathonAudit').doc(),{eventId:id,action:'budget.draft.imported',at:now,actor:actor.uid,
    lineCount:marathon2027BudgetDraft.length,plannedMinor:total,source:'KASA Life Marathon Complete Budget 6000 K450'});
  });
  return json({imported,plannedMinor:total,contingencyMinor:Math.round(total/10)});
 }catch(error){return fail(error);}
}
