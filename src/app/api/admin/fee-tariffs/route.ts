import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,requireCapability,sameOrigin,safeText} from '@/lib/security';
import {readApprovedFeeQuote} from '@/lib/approved-fee-quote';

export const runtime='nodejs';
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const versionPattern=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,59}$/;

/** Read-only registry for finance users; no estimated or draft rates. */
export async function GET(req:Request){
 try{
  await requireCapability(req,'finance.read');
  const snap=await db.collection('feeTariffs').orderBy('approvedAt','desc').limit(200).get();
  return json({tariffs:snap.docs.map(d=>({id:d.id,...d.data()}))});
 }catch(e){return fail(e);}
}

/** Only a School super administrator may register a previously approved tariff.
 * No default prices are inferred from public pages or programme titles.
 */
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await operator(req,['super_admin']);
  const body=await req.json();
  const programmeId=safeText(body?.programmeId,80);
  const packageId=safeText(body?.packageId,80);
  const version=safeText(body?.version,60);
  const approvalReference=safeText(body?.approvalReference,180);
  const effectiveDate=safeText(body?.effectiveDate,10);
  if(!slug.test(programmeId)||!slug.test(packageId)||!versionPattern.test(version))
   throw new HttpError(400,'Enter valid programme, package and tariff version identifiers.');
  if(approvalReference.length<8||!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)||
    Number.isNaN(Date.parse(effectiveDate+'T12:00:00Z')))
   throw new HttpError(400,'Documented approval reference and effective date are required.');
  if(body?.confirmedApproval!==true)
   throw new HttpError(400,'The responsible administrator must confirm the rates were formally approved.');
  const amounts=['tuition','practical','administration','accommodation','food'] as const;
  const components=Object.fromEntries(amounts.map(k=>[k,body[k]]));
  const total=amounts.reduce((sum,k)=>sum+Math.round(Number(body[k])*100),0)/100;
  const quote=readApprovedFeeQuote({
   status:'approved',programmeId,version,currency:'ZMW',...components,total
  });
  if(!quote)throw new HttpError(400,'All amounts must be valid ZMW figures with two-decimal precision.');
  // No externally supplied document IDs or overrides of an approved version.
  const id=[programmeId,packageId,version].join('--');
  const now=new Date().toISOString();
  const record={...quote,packageId,approvalReference,effectiveDate,
   approvedBy:actor.uid,approvedAt:now,locked:true};
  await db.runTransaction(async tx=>{
   const ref=db.collection('feeTariffs').doc(id);
   const current=await tx.get(ref);
   if(current.exists)throw new HttpError(409,'This approved tariff version already exists and cannot be overwritten.');
   tx.create(ref,record);
   tx.create(db.collection('auditLogs').doc(),{
    actor:actor.uid,action:'finance.tariff_approved',target:id,
    details:{programmeId,packageId,version,approvalReference,total},at:now
   });
  });
  return json({ok:true,id,tariff:record},201);
 }catch(e){return fail(e);}
}
