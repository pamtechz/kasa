import {db} from '@/lib/firebase-admin';
import {operator,sameOrigin,audit} from '@/lib/security';
import {fail,json} from '@/lib/errors';
import {programmeSchema,announcementSchema} from '@/lib/content';
import {initialIntake} from '@/lib/intake-policy';
import {defaultSite} from '@/lib/site';
import catalog from '@/data/kasa-starter-content.json';
import templates from '../../../../../scripts/starter-templates.json';
export const runtime='nodejs';
/** Explicit, non-destructive Firestore initialization. Never overwrites edited admin content. */
export async function POST(req:Request){
 try{
  sameOrigin(req);const actor=await operator(req,['super_admin']);
  const results={programmes:0,announcements:0,forms:0,settings:0,skipped:0};
  for(const candidate of catalog.programmes){
   const item=programmeSchema.parse(candidate),ref=db.collection('programmes').doc(item.id);
   if((await ref.get()).exists){results.skipped++;continue;}
   await ref.create({...item,seedSource:catalog.sourceNotes,updatedAt:new Date().toISOString()});results.programmes++;
  }
  for(const candidate of catalog.announcements){
   const item=announcementSchema.parse(candidate),ref=db.collection('announcements').doc(item.id);
   if((await ref.get()).exists){results.skipped++;continue;}
   await ref.create({...item,seedSource:catalog.sourceNotes,updatedAt:new Date().toISOString()});results.announcements++;
  }
  for(const template of templates){
   const exists=await db.collection('forms').where('slug','==',template.slug).limit(1).get();
   if(!exists.empty){results.skipped++;continue;}
   const ref=db.collection('forms').doc(template.slug);
   await ref.create({...template,published:false,version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});results.forms++;
  }
  const site=db.collection('settings').doc('site');
  if(!(await site.get()).exists){
   await site.create({content:{...defaultSite,contactEmail:'kasa@zamfirm.com',contactPhone:'+260 574 203 660',contactDescription:'Admissions and programme enquiries: House No. 40, Civic Centre, Area 22, Lusaka; Kamaila Farming Block, Chisamba.'},updatedAt:new Date().toISOString(),updatedBy:actor.uid});results.settings++;
  }else results.skipped++;
  const intake=db.collection('settings').doc('intake');
  if(!(await intake.get()).exists){await intake.create({policy:{...initialIntake,intakes:[{id:'january-2027',label:'January 2027',active:true},{id:'july-2027',label:'July 2027',active:true}]},updatedAt:new Date().toISOString(),updatedBy:actor.uid});results.settings++;}
  else results.skipped++;
  await audit(actor.uid,'catalog.starter_seeded','seed-2026-10-15',results);
  return json({ok:true,results,message:'Starter data seeded without overwriting existing records.'});
 }catch(e){return fail(e);}
}
