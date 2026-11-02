import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {operator} from '@/lib/security';
export const runtime='nodejs';
/** Only staff with the documents.read capability may list user-consented files. */
export async function GET(req:Request){
 try{
  await operator(req,['super_admin','admin','reviewer']);
  const shares=await db.collection('r2InstitutionShares').orderBy('sharedAt','desc').limit(60).get();
  const files=await Promise.all(shares.docs.map(async doc=>{
   const grant=doc.data();
   const asset=(await db.collection('r2Files').doc(doc.id).get()).data();
   if(!asset||asset.ownerUid!==grant.ownerUid||asset.status!=='ready'||
      asset.purpose!=='personal-document'||asset.sharedWithKasa!==true)return null;
   return {id:doc.id,ownerUid:grant.ownerUid,fileName:asset.fileName,
    contentType:asset.contentType,byteSize:asset.byteSize,sharedAt:grant.sharedAt,
    provider:'cloudflare-r2'};
  }));
  return json({files:files.filter((v):v is NonNullable<typeof v>=>v!==null)});
 }catch(e){return fail(e);}
}
