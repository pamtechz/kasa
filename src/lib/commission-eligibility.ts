import {readApprovedFeeQuote} from './approved-fee-quote';
import type {ApplicantRecord} from './types';

/** An accepted offer, CDF approval letter, self-report or pending receipt is
 * never a commission. Monetary eligibility requires a completed, externally
 * evidenced KASA enrollment AND the full approved fee paid to the institution.
 */
export type CommissionDecision={eligible:boolean;reason:string;amount:number;trigger:'payment'|'cdf_disbursement'|null};
const money=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0&&Math.abs(v*100-Math.round(v*100))<.000001;
export function commissionDecision(record:Partial<ApplicantRecord>&Record<string,any>):CommissionDecision{
 const deny=(reason:string):CommissionDecision=>({eligible:false,reason,amount:0,trigger:null});
 if(record.formKind!=='student'||!record.agentId)return deny('No linked student enrollment and referral.');
 if(!['payment_verified','cdf_funds_received','commission_paid'].includes(String(record.status)))
  return deny('Admission or government CDF approval alone does not create commission eligibility.');
 const quote=readApprovedFeeQuote(record.feeQuote);
 if(!quote||quote.total<=0)return deny('Approved, reconciled programme fee quotation is missing.');
 const c=record.commission;
 if(!c||!money(c.amount)||c.amount>50000||c.currency!=='ZMW'||!c.approvedAt||!record.referralVerified?.at)
  return deny('Commission rate or independent referral verification is missing.');
 if(record.fundingMethod==='self_funded'){
  const p=record.paymentVerification;
  if(!p||!p.recordedAt||!p.verifiedAt||p.verificationPending===true||!p.reference||
    !money(p.amount)||Math.round(p.amount*100)!==Math.round(quote.total*100)||
    record.fundingStatus!=='enrollment_payment_verified'||c.trigger!=='payment')
   return deny('Full student payment and independently verified enrollment have not been reconciled.');
  return {eligible:true,reason:'Full self-funded tuition and enrollment verified.',amount:c.amount,trigger:'payment'};
 }
 if(record.fundingMethod==='cdf'){
  const approval=record.cdfVerification,disbursement=record.cdfDisbursement;
  if(!approval?.reference||!approval.verifiedAt||!approval.verifiedBy||
    !disbursement?.governmentReference||!disbursement?.bankReference||
    !disbursement?.verifiedBy||!disbursement?.verifiedAt||
    !money(disbursement.amount)||Math.round(disbursement.amount*100)!==Math.round(quote.total*100)||
    disbursement.enrollmentConfirmed!==true||record.fundingStatus!=='government_funds_received_verified'||
    c.trigger!=='cdf_disbursement')
   return deny('Government CDF approval is insufficient: confirmed remittance of the full approved fee and enrollment are required.');
  return {eligible:true,reason:'Government CDF remittance received and enrollment verified.',amount:c.amount,trigger:'cdf_disbursement'};
 }
 return deny('Funding method is not reconciled.');
}
