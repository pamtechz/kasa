import 'server-only';
import {FieldPath} from 'firebase-admin/firestore';
import {getMessaging} from 'firebase-admin/messaging';
import {adminAuth,db} from '@/lib/firebase-admin';
import {marathonRoles} from '@/lib/marathon';
import type {Profile} from '@/lib/types';

type Device={id:string;uid:string;token:string;marathon:boolean};
type Audience='marathon'|'school';
function activeMarathonMember(profile:Profile){
 return profile.active===true&&(profile.role==='super_admin'||
  (profile.marathonAccess?.active===true&&marathonRoles.includes(profile.marathonAccess.role)));
}
async function sendPush(audience:Audience,title:string,body:string,path:string,recipient='all',recipientUid?:string){
 const devices:Device[]=[];
 let cursor:string|null=null;
 // Paginate document IDs without needing a composite Firestore index.
 for(let page=0;page<40;page++){
  let query=db.collection('mobilePushDevices').orderBy(FieldPath.documentId()).limit(250);
  if(cursor)query=query.startAfter(cursor);
  const snap=await query.get();
  if(snap.empty)break;
  for(const doc of snap.docs){
   const value=doc.data();
   if(typeof value.uid==='string'&&typeof value.token==='string')
    devices.push({id:doc.id,uid:value.uid,token:value.token,marathon:value.marathon===true});
  }
  cursor=snap.docs[snap.docs.length-1].id;
  if(snap.size<250)break;
 }
 const candidates=devices.filter(d=>audience==='school'||d.marathon);
 if(candidates.length===0)return {delivered:0,failed:0};
 const profileIds=[...new Set(candidates.map(d=>d.uid))];
 const authorized=new Set<string>();
 for(let i=0;i<profileIds.length;i+=100){
  const refs=profileIds.slice(i,i+100).map(uid=>db.collection('profiles').doc(uid));
  const docs=await db.getAll(...refs);
  docs.forEach((snap,index)=>{
   const p=snap.data() as Profile|undefined;
   const uid=profileIds[i+index];
   if(!p||!p.active)return;
   if(audience==='marathon'&&activeMarathonMember(p))authorized.add(uid);
   // The current school notification API excludes student/agent reference notices,
   // and finance cannot access its inbox. Never push inaccessible notices.
   if(audience==='school'&&(
     recipientUid?uid===recipientUid:
     ['super_admin','admin','reviewer'].includes(p.role)&&
     (p.role==='super_admin'||p.role==='admin'||recipient==='all'||p.role===recipient)
   ))authorized.add(uid);
  });
 }
 const targets=candidates.filter(d=>authorized.has(d.uid));
 let delivered=0,failed=0;
 for(let i=0;i<targets.length;i+=500){
  const chunk=targets.slice(i,i+500);
  // Generic lock-screen text intentionally contains no student or task details.
  const result=await getMessaging(adminAuth.app).sendEachForMulticast({
   tokens:chunk.map(x=>x.token),notification:{title,body},
   data:{path,workspace:audience},
   android:{priority:'high'}
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
/** Reverify School + secondary Marathon role immediately before pushing. */
export function sendMarathonPush(title:string,body:string,path='/marthon/operations'){
 return sendPush('marathon',title,body,path);
}
/** Respect the existing School recipient scope, not client-supplied device roles. */
export function sendSchoolPush(recipient:string,recipientUid?:string){
 return sendPush('school','KASA School — new notification','There is a new notification in your School workspace.','/dashboard/notifications',recipient,recipientUid);
}
