import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {marathonIdentity,canReview,canManage} from '@/lib/marathon';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const identity=await marathonIdentity(req);
  const [tasks,meta,suggestions,members]=await Promise.all([
   db.collection('marathonTasks').limit(500).get(),
   db.collection('marathonMeta').doc('source').get(),
   canReview(identity.role)?db.collection('marathonSuggestions').limit(200).get():Promise.resolve(null),
   identity.role==='super_admin'?db.collection('marathonMembers').limit(200).get():Promise.resolve(null)
  ]);
  return json({
   identity,
   tasks:tasks.docs.map(x=>({id:x.id,...x.data()})),
   meta:meta.data()||null,
   suggestions:suggestions?suggestions.docs.map(x=>({id:x.id,...x.data()})):[],
   members:members?members.docs.map(x=>({uid:x.id,...x.data()})):[],
   permissions:{edit:['super_admin','kasaAdmin','kasaOperations','kasaEditor'].includes(identity.role),
    review:canReview(identity.role),manage:canManage(identity.role),super:identity.role==='super_admin'}
  });
 }catch(e){return fail(e);}
}
