import {db} from '@/lib/firebase-admin';
import {requirePermission} from '@/lib/security';
import {fail,json} from '@/lib/errors';
export const runtime='nodejs';
export const dynamic='force-dynamic';

/** Read-only setup diagnostics. Never auto-seed or expose applicant records. */
export async function GET(req:Request){
 try{
  await requirePermission(req,'setup.read');
  const [programmes,announcements,forms,intake,site,bootstrap]=await Promise.all([
   db.collection('programmes').limit(1).get(),
   db.collection('announcements').limit(1).get(),
   db.collection('forms').limit(1).get(),
   db.collection('settings').doc('intake').get(),
   db.collection('settings').doc('site').get(),
   db.collection('settings').doc('bootstrap').get()
  ]);
  return json({database:'connected',collections:{
   programmes:!programmes.empty,announcements:!announcements.empty,
   forms:!forms.empty,intake:intake.exists,website:site.exists,bootstrap:bootstrap.exists
  },intakeOpen:intake.data()?.policy?.applicationsOpen===true});
 }catch(error){return fail(error);}
}
