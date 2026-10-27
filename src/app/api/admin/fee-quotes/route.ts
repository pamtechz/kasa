import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {requireCapability,sameOrigin,safeText} from '@/lib/security';
import {readApprovedFeeQuote} from '@/lib/approved-fee-quote';
import {invalidateSubmissionsCache} from '@/lib/server-cache';

export const runtime='nodejs';

/** Assign a single immutable approved tariff snapshot to one student application.
 * Legacy records are reviewed individually; no guessed historic backfill.
 */
export async function POST(req:Request){
 try{
  sameOrigin(req);
  const actor=await requireCapability(req,'finance.record');
  const body=await req.json();
  const submissionId=safeText(body?.submissionId,100);
  const tariffId=safeText(body?.tariffId,240);
  const reconciliationEvidence=safeText(body?.reconciliationEvidence,240);
  const agreementReference=safeText(body?.agreementReference,240);
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(submissionId)||
     !/^[a-zA-Z0-9._-]{1,240}$/.test(tariffId))
   throw new HttpError(400,'Valid application and approved tariff IDs are required.');
  if(reconciliationEvidence.length<8||body?.confirmedProgrammeAndPackage!==true)
   throw new HttpError(400,'Record supporting evidence and explicitly verify programme and package before reconciliation.');
  const submissionRef=db.collection('submissions').doc(submissionId);
  const tariffRef=db.collection('feeTariffs').doc(tariffId);
  const now=new Date().toISOString();
  let issued:Record<string,unknown>={};
  await db.runTransaction(async tx=>{
   const [appSnap,tariffSnap]=await Promise.all([tx.get(submissionRef),tx.get(tariffRef)]);
   if(!appSnap.exists)throw new HttpError(404,'Student application not found.');
   const app=appSnap.data()!;
   if(app.formKind!=='student'||app.status==='rejected')
    throw new HttpError(409,'Only active student applications can receive fee quotations.');
   // A draft/corrupt prior quote needs separate incident investigation; never silently overwrite.
   if(app.feeQuote!==undefined&&app.feeQuote!==null)
    throw new HttpError(409,'This application already has a fee snapshot. Reconciliation cannot overwrite an agreement.');
   if(!tariffSnap.exists)throw new HttpError(404,'Approved tariff not found.');
   const tariff=tariffSnap.data()!;
   const approved=readApprovedFeeQuote(tariff);
   if(!approved||tariff.locked!==true||!tariff.approvedBy||!tariff.approvalReference)
    throw new HttpError(409,'Tariff is not an authorized, immutable approved version.');
   if(typeof tariff.effectiveDate!=='string'||tariff.effectiveDate>now.slice(0,10))
    throw new HttpError(409,'Tariff is not yet effective. Use a formally approved applicable version.');
   if(['letter_issued','payment_verified','cdf_submitted','cdf_approved','commission_paid'].includes(app.status)&&
     agreementReference.length<8)
    throw new HttpError(409,'Previously issued letters or funding agreements require an existing documented agreement reference.');
   const paid=Number(app.paymentVerification?.amount||0);
   if(!Number.isFinite(paid)||paid<0||Math.round(paid*100)>Math.round(approved.total*100))
    throw new HttpError(409,'Existing payment history exceeds this tariff or requires reconciliation.');
   issued={...approved,packageId:tariff.packageId,
    tariffId,approvalReference:tariff.approvalReference,
    approvedAt:tariff.approvedAt,approvedBy:tariff.approvedBy,
    reconciliationEvidence,agreementReference:agreementReference||null,
    assignedAt:now,assignedBy:actor.uid};
   // The quote is an immutable agreement snapshot; later tariff revisions do not change it.
   tx.update(submissionRef,{feeQuote:issued,feeQuoteUpdatedAt:now,updatedAt:now});
   tx.create(db.collection('auditLogs').doc(),{
    actor:actor.uid,action:'finance.fee_quote_assigned',target:submissionId,
    details:{tariffId,reconciliationEvidence,agreementReference:agreementReference||null,
      previousPaid:paid,quoteTotal:approved.total},at:now
   });
  });
  invalidateSubmissionsCache();
  return json({ok:true,submissionId,feeQuote:issued},201);
 }catch(e){return fail(e);}
}
