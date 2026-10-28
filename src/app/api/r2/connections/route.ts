import {randomUUID} from 'node:crypto';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {sameOrigin,rateLimit,audit} from '@/lib/security';
import {storageIdentity,platformR2} from '@/lib/r2-storage';
import {validateR2Address,signR2Url} from '@/lib/r2-signing';
import {encryptR2Secrets} from '@/lib/r2-crypto';
export const runtime='nodejs';
const schema=z.object({label:z.string().trim().min(1).max(80),
 accountId:z.string().trim().length(32),bucket:z.string().min(3).max(63),
 jurisdiction:z.enum(['default','eu','us','fedramp']).default('default'),
 accessKeyId:z.string().min(8).max(200),
 secretAccessKey:z.string().min(20).max(300)}).strict();
export async function GET(req:Request){
 try{
  const {uid}=await storageIdentity(req);
  const list=await db.collection('r2Connections').where('ownerUid','==',uid).limit(25).get();
  return json({platformAvailable:Boolean(platformR2()),
   connections:list.docs.map(d=>({id:d.id,label:d.data().label,accountId:d.data().accountId,bucket:d.data().bucket,
    jurisdiction:d.data().jurisdiction,status:d.data().status,createdAt:d.data().createdAt}))});
 }catch(e){return fail(e);}
}
export async function POST(req:NextRequest){
 try{
  sameOrigin(req);const {uid}=await storageIdentity(req);
  await rateLimit(req,'r2-connect:'+uid,4,60);
  const parsed=schema.safeParse(await req.json().catch(()=>({})));
  if(!parsed.success)throw new HttpError(400,'Enter a valid R2 account ID, bucket name, and scoped access credentials.');
  const v=parsed.data;
  try{validateR2Address(v.accountId,v.bucket,v.jurisdiction);}catch(e){throw new HttpError(400,e instanceof Error?e.message:'Invalid bucket configuration.');}
  // Test bucket-scoped ListObjectsV2 (no arbitrary URLs or user-provided endpoints).
  // Never persist or log plaintext R2 credentials.
  const test=signR2Url(v,'GET','',30,undefined,{'list-type':'2','max-keys':'1'});
  let result:Response;
  try{result=await fetch(test,{signal:AbortSignal.timeout(9000),cache:'no-store'});}
  catch{throw new HttpError(422,'Unable to reach Cloudflare R2. Check account ID, jurisdiction and network.');}
  if(!result.ok)throw new HttpError(422,'Cloudflare rejected bucket access. Check scoped Object Read & Write credentials and bucket jurisdiction.');
  const existing=await db.collection('r2Connections').where('ownerUid','==',uid).limit(10).get();
  if(existing.docs.filter(d=>d.data().status==='active').length>=3)
   throw new HttpError(409,'Maximum three active bucket connections. Disconnect an unused connection first.');
  const id=randomUUID(),now=new Date().toISOString();
  const encrypted=encryptR2Secrets(id,{accessKeyId:v.accessKeyId,secretAccessKey:v.secretAccessKey});
  // Batch prevents a public connection record existing without encrypted credentials.
  const batch=db.batch();
  batch.create(db.collection('r2Connections').doc(id),{ownerUid:uid,label:v.label,accountId:v.accountId,
   bucket:v.bucket,jurisdiction:v.jurisdiction,status:'active',createdAt:now,updatedAt:now});
  batch.create(db.collection('r2ConnectionSecrets').doc(id),{ownerUid:uid,encrypted,updatedAt:now});
  await batch.commit();
  await audit(uid,'r2.bucket_connected',id,{bucket:v.bucket,jurisdiction:v.jurisdiction}).catch(()=>{});
  return json({id,label:v.label,bucket:v.bucket,status:'active'},201);
 }catch(e){return fail(e);}
}
