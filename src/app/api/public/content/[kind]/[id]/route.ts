import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {contentCollection,visibleAnnouncement,type Announcement} from '@/lib/content';
export const runtime='nodejs';
export async function GET(_:Request,{params}:{params:Promise<{kind:string;id:string}>}){
 try{
  const {kind,id}=await params,collection=contentCollection(kind);
  if(!collection||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))throw new HttpError(404,'Item not found.');
  const record=await db.collection(collection).doc(id).get();
  if(!record.exists||!record.data()?.published)throw new HttpError(404,'This item is not published.');
  if(collection==='announcements'&&!visibleAnnouncement(record.data() as Announcement))throw new HttpError(404,'This announcement is not active.');
  return json({item:{...record.data(),id}});
 }catch(e){return fail(e);}
}
