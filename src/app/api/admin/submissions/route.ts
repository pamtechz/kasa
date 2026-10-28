import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,sameOrigin,audit,newId,safeText,requireCapability} from '@/lib/security';
import type {ApplicantRecord,SubmissionStatus} from '@/lib/types';
import {submissionsCache, SUBMISSIONS_CACHE_TTL, invalidateSubmissionsCache} from '@/lib/server-cache';

export const runtime='nodejs';

export async function GET(req:Request){
 try{
  const user=await operator(req,['super_admin','admin','reviewer','agent']);
  const cacheKey = user.role === 'agent' ? `agent-${user.uid}` : 'all';
  const cached = submissionsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SUBMISSIONS_CACHE_TTL) {
   return json({submissions: cached.items});
  }
  const q=user.role==='agent'?db.collection('submissions').where('agentId','==',user.uid):db.collection('submissions');
  const result=await q.limit(300).get();
  const items=result.docs.map(x=>{
   const item=x.data() as ApplicantRecord;
   if(user.role==='agent')return {
    id:x.id,reference:item.reference,formTitle:item.formTitle,status:item.status,
    submittedAt:item.submittedAt,agentId:item.agentId
   };
   return {...item,id:x.id};
  }).sort((a,b)=>String(b.submittedAt).localeCompare(String(a.submittedAt)));
  submissionsCache.set(cacheKey, {items, timestamp: Date.now()});
  return json({submissions:items});
 }catch(e){return fail(e);}
}

export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await requireCapability(req,'applications.review');
  const body=await req.json();
  const studentName=safeText(body.name||body.studentName,120);
  const email=safeText(body.email,160).toLowerCase();
  const phone=safeText(body.phone,50);
  const nrc=safeText(body.nrc||body.nrcNumber,40);
  const programme=safeText(body.programme,150);
  const fundingMethod:( 'cdf' | 'self_funded' )=(body.fundingMethod==='self_funded'?'self_funded':'cdf');
  const district=safeText(body.district,80);
  const initialStatus:SubmissionStatus='submitted'; // Registration is never an acceptance decision.
  const noteText=safeText(body.note,500);

  if(!studentName) throw new HttpError(400,'Student full name is required.');
  if(!programme) throw new HttpError(400,'Programme is required.');

  const id=newId();
  const reference=`KASA-${new Date().getFullYear()}-${id.replace(/-/g,'').slice(0,8).toUpperCase()}`;
  const now=new Date().toISOString();

  const answers:Record<string,unknown>={
   'full-name':studentName,
   'name':studentName,
   'email':email,
   'phone':phone,
   'nrc':nrc,
   'programme':programme,
   'course':programme,
   'district':district,
   'fundingMethod':fundingMethod
  };

  const newRecord:ApplicantRecord={
   id,
   reference,
   formId:'manual-admin-entry',
   formTitle:programme,
   formKind:'student',
   formVersion:1,
   status:initialStatus,
   answers,
   agentId:actor.role==='agent'?actor.uid:null,
   submittedAt:now,
   updatedAt:now,
   fundingMethod,
   internalNotes:noteText?[{body:noteText,at:now,by:actor.uid}]:[]
  };

  await db.collection('submissions').doc(id).set(newRecord);
  invalidateSubmissionsCache();
  await audit(actor.uid,'application.created',id,{reference,programme});
  return json({ok:true,id,reference},201);
 }catch(e){return fail(e);}
}
