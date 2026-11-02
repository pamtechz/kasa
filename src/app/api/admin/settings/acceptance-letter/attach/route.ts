import {db} from '@/lib/firebase-admin';
import {HttpError,fail,json} from '@/lib/errors';
import {operator,sameOrigin,audit} from '@/lib/security';
export const runtime='nodejs';
export async function POST(req:Request){
 try{
  sameOrigin(req);const actor=await operator(req,['super_admin','admin']);
  const body=await req.json().catch(()=>({})),id=body?.fileId;
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))
   throw new HttpError(400,'Choose a completed PDF upload.');
  const asset=(await db.collection('r2Files').doc(id).get()).data();
  if(!asset||asset.status!=='ready'||asset.ownerUid!==actor.uid||
     asset.purpose!=='acceptance-pdf'||asset.connectionId==='platform'||
     asset.contentType!=='application/pdf'||asset.key!=='private/'+actor.uid+'/acceptance-pdf/'+id+'.pdf'||
     !Number.isFinite(asset.byteSize)||asset.byteSize<1||asset.byteSize>25*1024*1024)
   throw new HttpError(403,'Only your verified KASA acceptance PDF can be attached.');
  const now=new Date().toISOString(),customPdf={
   type:'upload' as const,url:'r2asset:'+id,fileName:String(asset.fileName||'Acceptance.pdf').slice(0,140),
   fileSize:asset.byteSize,uploadedAt:now
  };
  await db.collection('settings').doc('acceptanceLetter').set({
   packSource:'custom',customPdf,updatedAt:now,updatedBy:actor.uid
  },{merge:true});
  await audit(actor.uid,'settings.acceptance_pack_pdf.r2_attached','acceptanceLetter',{fileId:id});
  return json({ok:true,customPdf},201);
 }catch(e){return fail(e);}
}
