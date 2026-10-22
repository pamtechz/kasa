import {db} from '@/lib/firebase-admin';
import {defaultSite,siteSchema,sanitizeSite} from '@/lib/site';
import {requirePermission,audit,sameOrigin} from '@/lib/security';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  await requirePermission(req,'content.read');
  const doc=await db.collection('settings').doc('site').get();
  return json({site:doc.exists?sanitizeSite(doc.data()?.content):defaultSite,updatedAt:doc.data()?.updatedAt||null});
 }catch(e){return fail(e);}
}
export async function PUT(req:Request){
 try{
  sameOrigin(req);const actor=await requirePermission(req,'content.manage');
  const parsed=siteSchema.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,parsed.error.issues.map(x=>x.message).slice(0,3).join('; '));
  await db.collection('settings').doc('site').set({content:parsed.data,updatedAt:new Date().toISOString(),updatedBy:actor.uid},{merge:true});
  await audit(actor.uid,'website.updated','site');
  return json({ok:true});
 }catch(e){return fail(e);}
}
