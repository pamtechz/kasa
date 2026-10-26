import 'server-only';
import {FieldPath} from 'firebase-admin/firestore';
import {getMessaging} from 'firebase-admin/messaging';
import {adminAuth,db} from '@/lib/firebase-admin';
import type {Profile} from '@/lib/types';

type Device={id:string;uid:string;token:string};
function memberIsActive(profile:Profile|undefined){
 return Boolean(profile?.active&&(profile.role==='super_admin'||profile.marathonAccess?.active===true));
}
/** Push is best effort; no personal task details or contact data leave this channel.
 * Every send rechecks the live KASA School profile, including revoked Marathon access.
 */
export async function sendMarathonPush(title:string,body:string,path='/marthon/operations'){
 const devices:Device[]=[];
 let cursor:string|null=null;
 for(let page=0;page<40;page++){
  let query=db.collection('mobilePushDevices').orderBy(FieldPath.documentId()).limit(250);
  if(cursor)query=query.startAfter(cursor);
  const snap=await query.get();
  if(snap.empty)break;
  for(const doc of snap.docs){
   const value=doc.data();
   if(value.marathon===true&&typeof value.uid==='string'&&typeof value.token==='string')
    devices.push({id:doc.id,uid:value.uid,token:value.token});
  }
  cursor=snap.docs[snap.docs.length-1].id;
  if(snap.size<250)break;
 }
 if(devices.length===0)return {delivered:0,failed:0};
 const profileIds=[...new Set(devices.map(d=>d.uid))];
 const allowed=new Set<string>();
 for(let i=0;i<profileIds.length;i+=100){
  const refs=profileIds.slice(i,i+100).map(uid=>db.collection('profiles').doc(uid));
  const docs=await db.getAll(...refs);
  docs.forEach((s,index)=>{if(memberIsActive(s.data() as Profile|undefined))allowed.add(profileIds[i+index]);});
 }
 const targets=devices.filter(d=>allowed.has(d.uid));
 let delivered=0,failed=0;
 for(let i=0;i<targets.length;i+=500){
  const chunk=targets.slice(i,i+500);
  const result=await getMessaging(adminAuth.app).sendEachForMulticast({
   tokens:chunk.map(x=>x.token),notification:{title,body},
   data:{path,workspace:'marathon'},
   android:{priority:'high'},
  });
  delivered+=result.successCount;failed+=result.failureCount;
  await Promise.all(result.responses.map(async(response,index)=>{
   if(response.success)return;
   const code=response.error?.code||'';
   if(code==='messaging/registration-token-not-registered'||code==='messaging/invalid-registration-token')
    await db.collection('mobilePushDevices').doc(chunk[index].id).delete().catch(()=>{});
  }));
 }
 return {delivered,failed};
}
