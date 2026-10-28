import {readApprovedFeeQuote} from './approved-fee-quote';
import type {ApplicantRecord} from './types';

export type FundingDecision={funded:boolean;reason:string;channel:'payment'|'cdf_disbursement'|null};
const validMoney=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0&&Math.abs(v*100-Math.round(v*100))<0.000001;
/** A recorded status is insufficient without independently verified receipt, full
 * approved price and completed enrollment. Applies to direct and referred students.
 * Legacy records without source evidence must be reconciled, never inferred.
 */
export function fundedEnrollment(record:Partial<ApplicantRecord>&Record<string,any>):FundingDecision{
 const reject=(reason:string):FundingDecision=>({funded:false,reason,channel:null});
 if(record.formKind!=='student'||!['payment_verified','cdf_funds_received','commission_paid'].includes(String(record.status)))
  return reject('Application, acceptance and CDF approval alone are not funded enrollment.');
 const quote=readApprovedFeeQuote(record.feeQuote);
 if(!quote||quote.total<=0)return reject('An approved fee quotation is missing.');
 if(record.fundingMethod==='self_funded'){
  const p=record.paymentVerification;
  if(!p||!p.recordedAt||!p.verifiedAt||!p.reference||!p.verifiedBy||
   p.verificationPending===true||!validMoney(p.amount)||
   Math.round(p.amount*100)!==Math.round(quote.total*100)||
   record.fundingStatus!=='enrollment_payment_verified')
   return reject('Complete student tuition receipt and verified enrollment are missing.');
  return {funded:true,reason:'Full self-funded fees and enrollment verified.',channel:'payment'};
 }
 if(record.fundingMethod==='cdf'){
  const approval=record.cdfVerification,disbursement=record.cdfDisbursement;
  if(!approval?.reference||!approval.verifiedAt||!approval.verifiedBy||
    !disbursement?.governmentReference||!disbursement?.bankReference||
    !disbursement?.verifiedBy||!disbursement?.verifiedAt||
    !validMoney(disbursement.amount)||Math.round(disbursement.amount*100)!==Math.round(quote.total*100)||
    disbursement.enrollmentConfirmed!==true||record.fundingStatus!=='government_funds_received_verified')
   return reject('CDF government approval alone is insufficient. Full bank remittance and enrollment confirmation are required.');
  return {funded:true,reason:'Government CDF remittance and student enrollment verified.',channel:'cdf_disbursement'};
 }
 return reject('Funding method is not reconciled.');
}
