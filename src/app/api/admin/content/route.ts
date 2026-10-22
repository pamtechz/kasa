import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {requirePermission,sameOrigin,audit} from '@/lib/security';
import {programmeSchema,announcementSchema,contentCollection} from '@/lib/content';
export const runtime='nodejs';

const serverContentCache: Record<string, {items: any[]; timestamp: number}> = {};
const CONTENT_CACHE_TTL = 30_000;

export async function GET(req:Request){
 try{
  await requirePermission(req,'content.read');
  const kind=new URL(req.url).searchParams.get('kind')||'',collection=contentCollection(kind);
  if(!collection)throw new HttpError(400,'Select programmes or announcements.');
  const cached = serverContentCache[collection];
  if(cached && Date.now() - cached.timestamp < CONTENT_CACHE_TTL){
   return json({items: cached.items});
  }
  const result=await db.collection(collection).limit(250).get();
  const items = result.docs.map(d=>({...d.data(),id:d.id}));
  serverContentCache[collection] = {items, timestamp: Date.now()};
  return json({items});
 }catch(e){return fail(e);}
}
export async function POST(req:Request){
 try{
  sameOrigin(req);const who=await requirePermission(req,'content.manage');
  const body=await req.json(),collection=contentCollection(body?.kind);
  if(!collection)throw new HttpError(400,'Invalid content type.');
  const schema=collection==='programmes'?programmeSchema:announcementSchema;
  const parsed=schema.safeParse(body?.item);
  if(!parsed.success) {
   const issues = parsed.error.issues.map(x=>`${x.path.join('.') || 'field'}: ${x.message}`).join('; ');
   throw new HttpError(400,`Validation error (${issues})`);
  }
  const item=parsed.data,ref=db.collection(collection).doc(item.id);
  const existing=await ref.get();
  if(existing.exists)throw new HttpError(409,'An item with this ID already exists. Use update.');
  await ref.create({...item,updatedAt:new Date().toISOString(),updatedBy:who.uid});
  delete serverContentCache[collection];
  await audit(who.uid,collection+'.created',item.id);
  return json({ok:true,id:item.id},201);
 }catch(e){return fail(e);}
}
export async function PUT(req:Request){
 try{
  sameOrigin(req);const who=await requirePermission(req,'content.manage');
  const body=await req.json(),collection=contentCollection(body?.kind);
  if(!collection)throw new HttpError(400,'Invalid content type.');
  const schema=collection==='programmes'?programmeSchema:announcementSchema;
  const parsed=schema.safeParse(body?.item);
  if(!parsed.success) {
   const issues = parsed.error.issues.map(x=>`${x.path.join('.') || 'field'}: ${x.message}`).join('; ');
   throw new HttpError(400,`Validation error (${issues})`);
  }
  const ref=db.collection(collection).doc(parsed.data.id);
  if(!(await ref.get()).exists)throw new HttpError(404,'Record does not exist.');
  await ref.set({...parsed.data,updatedAt:new Date().toISOString(),updatedBy:who.uid},{merge:true});
  delete serverContentCache[collection];
  await audit(who.uid,collection+'.updated',parsed.data.id);
  return json({ok:true});
 }catch(e){return fail(e);}
}
export async function DELETE(req:Request){
 try{
  sameOrigin(req);const who=await requirePermission(req,'content.manage');
  const body=await req.json(),collection=contentCollection(body?.kind),id=String(body?.id||'');
  if(!collection||!/^[a-z0-9-]{3,90}$/.test(id))throw new HttpError(400,'Invalid item.');
  const ref=db.collection(collection).doc(id),snap=await ref.get();
  if(!snap.exists)throw new HttpError(404,'Not found.');
  await ref.delete();
  delete serverContentCache[collection];
  await audit(who.uid,collection+'.deleted',id);
  return json({ok:true});
 }catch(e){return fail(e);}
}
