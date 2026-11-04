import {FieldValue} from 'firebase-admin/firestore';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {marathonIdentity} from '@/lib/marathon';
import {getMarathonEvent,requireBudgetAccess} from '@/lib/marathon-event-server';
import {sameOrigin} from '@/lib/security';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const identity=await marathonIdentity(req),{id}=await params,event=await getMarathonEvent(id);
  const snap=await db.collection('marathonEvents').doc(id).collection('notices').orderBy('createdAt','desc').limit(10).get();
  let canOpenBudget=false;try{requireBudgetAccess(identity,event,'read');canOpenBudget=true;}catch{}
  const notices=snap.docs.filter(d=>{
   const data=d.data();return Array.isArray(data.recipientUids)&&data.recipientUids.includes(identity.uid)&&!data.readBy?.includes(identity.uid);
  }).map(d=>{const x=d.data();return {id:d.id,title:String(x.title||''),message:String(x.message||''),createdAt:x.createdAt};});
  return json({notices,canOpenBudget});
 }catch(error){return fail(error);}
}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  sameOrigin(req);const identity=await marathonIdentity(req),{id}=await params;await getMarathonEvent(id);
  const body=await req.json();
  if(typeof body.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(body.id))throw new HttpError(400,'Invalid notice.');
  const ref=db.collection('marathonEvents').doc(id).collection('notices').doc(body.id);
  await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists||!snap.data()?.recipientUids?.includes(identity.uid))throw new HttpError(404,'Notice not found.');
   tx.update(ref,{readBy:FieldValue.arrayUnion(identity.uid)});
  });
  return json({ok:true});
 }catch(error){return fail(error);}
}
