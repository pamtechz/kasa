import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {marathonIdentity,canReview,canManage,canEdit} from '@/lib/marathon';
import {marathonRoles} from '@/lib/marathon';
import type {Profile} from '@/lib/types';
import {marathonSuggestionsPage} from '@/lib/marathon-suggestions';
import seed from '@/data/marathon-seed.json';
import {checklistSourceInfo} from '@/lib/marathon-seed-import';

export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const identity=await marathonIdentity(req);
  const [tasks,meta,suggestions,profiles]=await Promise.all([
   db.collection('marathonTasks').limit(500).get(),
   db.collection('marathonMeta').doc('source').get(),
   marathonSuggestionsPage(identity),
   // Super admin manages the second role from this Marathon page, but all roles
   // are stored only in the existing KASA School profiles collection.
   canManage(identity.role)
    ?db.collection('profiles').where('marathonAccess.role','in',[...marathonRoles]).limit(300).get()
    :Promise.resolve(null)
  ]);
  return json({
   identity,
   tasks:tasks.docs.map(x=>({id:x.id,...x.data()})),
   meta:meta.data()||null,
   source:checklistSourceInfo(seed),
   ...suggestions,
   members:profiles?profiles.docs.map(d=>{
    const p=d.data() as Profile;
    return {uid:d.id,email:p.email,displayName:p.displayName,schoolRole:p.role,
      role:p.marathonAccess?.role,schoolActive:p.role!=='marathon_only'&&p.active===true,marathonActive:p.marathonAccess?.active===true,active:p.role!=='student'&&p.active===true&&p.marathonAccess?.active===true};
   }):[],
   permissions:{edit:canEdit(identity.role),review:canReview(identity.role),
    manage:canManage(identity.role),super:identity.role==='super_admin'}
  });
 }catch(e){return fail(e);}
}
