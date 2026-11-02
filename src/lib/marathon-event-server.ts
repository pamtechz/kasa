import 'server-only';
import {db} from '@/lib/firebase-admin';
import {HttpError} from '@/lib/errors';
import type {MarathonIdentity} from '@/lib/marathon';
import {canEdit} from '@/lib/marathon';
import {LEGACY_MARATHON_EVENT_ID,legacyMarathonEvent,type MarathonEvent} from './marathon-event-model';

export function validEventId(id:string){return id===LEGACY_MARATHON_EVENT_ID||/^ev-[0-9a-f-]{36}$/.test(id);}
export async function getMarathonEvent(id:string):Promise<MarathonEvent>{
 if(!validEventId(id))throw new HttpError(400,'Invalid event ID.');
 const doc=await db.collection('marathonEvents').doc(id).get();
 if(doc.exists)return {...doc.data(),id} as MarathonEvent;
 if(id===LEGACY_MARATHON_EVENT_ID)return legacyMarathonEvent;
 throw new HttpError(404,'Event not found.');
}
export function requireBudgetAccess(identity:MarathonIdentity,event:MarathonEvent,mode:'read'|'write'|'approve'){
 if(identity.role==='super_admin')return;
 const admin=event.adminUids.includes(identity.uid);
 const editor=event.budgetEditorUids.includes(identity.uid);
 const approver=event.budgetApproverUids.includes(identity.uid);
 const viewer=event.budgetViewerUids.includes(identity.uid);
 const memberRole=identity.role!=='kasaClient';
 const allowed=mode==='read'?(admin||editor||approver||viewer):
  mode==='write'?(admin||editor)&&memberRole:(admin||approver)&&memberRole;
 if(!allowed)throw new HttpError(403,'You are not assigned this event budget permission.');
}
export function requireEventTaskEdit(identity:MarathonIdentity,event:MarathonEvent){
 if(identity.role==='super_admin')return;
 // Preserve the existing checklist editors of the 2027 legacy event until
 // explicit per-event assignments have been completed by an administrator.
 if(event.id===LEGACY_MARATHON_EVENT_ID&&canEdit(identity.role))return;
 if(!canEdit(identity.role)||!event.adminUids.includes(identity.uid))
  throw new HttpError(403,'This event checklist requires an assigned editor.');
}
