import {db} from '@/lib/firebase-admin';
import {defaultAutomations,automationSchema} from '@/lib/automations';
import {operator,audit,sameOrigin} from '@/lib/security';
import {fail,json,HttpError} from '@/lib/errors';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  await operator(req,['super_admin','admin']);
  const doc=await db.collection('settings').doc('automations').get();
  const value=automationSchema.safeParse(doc.data()?.config);
  return json({config:value.success?value.data:defaultAutomations});
 }catch(e){return fail(e);}
}
export async function PUT(req:Request){
 try{
  sameOrigin(req);
  const who=await operator(req,['super_admin','admin']);
  const parsed=automationSchema.safeParse(await req.json());
  if(!parsed.success)throw new HttpError(400,parsed.error.issues.map(x=>x.message).join('; '));
  await db.collection('settings').doc('automations').set({config:parsed.data,updatedBy:who.uid,updatedAt:new Date().toISOString()},{merge:true});
  await audit(who.uid,'automations.updated','rules',{count:parsed.data.rules.length});
  return json({ok:true});
 }catch(e){return fail(e);}
}
