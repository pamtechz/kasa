import {readApprovedFeeQuote} from './approved-fee-quote';
import {fundedEnrollment} from './funded-enrollment';
export type FinanceFlag={id:'missing_quote'|'invalid_payment'|'overpayment'|'awaiting_enrollment'|'cdf_awaiting_remittance'|'unverified_cdf'|'legacy_receipt_gap';level:'critical'|'review';message:string};
export function cents(value:unknown):number|null{
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>10000000||
  Math.abs(value*100-Math.round(value*100))>0.000001)return null;
 return Math.round(value*100);
}
export function financeSnapshot(record:Record<string,any>,receipts?:{amountMinor:number}[]){
 const quote=readApprovedFeeQuote(record.feeQuote);
 const feeMinor=quote?cents(quote.total):null;
 const actualPaid=record.paymentVerification?.amount;
 const paidMinor=actualPaid===undefined||actualPaid===null?0:cents(actualPaid);
 const isCdf=record.fundingMethod==='cdf';
 const disbursement=record.cdfDisbursement;
 const cdfReceivedMinor=isCdf&&disbursement?.verifiedAt&&disbursement?.bankReference&&disbursement?.governmentReference&&disbursement?.enrollmentConfirmed
  ?cents(disbursement.amount):0;
 const receivedMinor=paidMinor===null||cdfReceivedMinor===null?null:paidMinor+cdfReceivedMinor;
 const balanceMinor=feeMinor===null||receivedMinor===null?null:Math.max(0,feeMinor-receivedMinor);
 const fullyEnrolled=fundedEnrollment(record).funded;
 const flags:FinanceFlag[]=[];
 const needsQuote=['accepted','letter_issued','cdf_submitted','cdf_approved','cdf_funds_received','payment_verified','commission_paid'].includes(String(record.status))
  ||(paidMinor!==null&&paidMinor>0)||Boolean(record.paymentVerification?.reference);
 if(feeMinor===null&&needsQuote)flags.push({id:'missing_quote',level:'critical',message:'Approved fee quotation missing or invalid for a processed application'});
 if(paidMinor===null)flags.push({id:'invalid_payment',level:'critical',message:'Recorded tuition amount needs reconciliation'});
 if(feeMinor!==null&&receivedMinor!==null&&receivedMinor>feeMinor)
  flags.push({id:'overpayment',level:'critical',message:'Recorded funds exceed approved fees'});
 if(feeMinor!==null&&receivedMinor===feeMinor&&feeMinor>0&&!fullyEnrolled)
  flags.push({id:'awaiting_enrollment',level:'review',message:'Full fees recorded; independent enrollment verification outstanding'});
 if(isCdf&&record.cdfVerification?.verifiedAt&&!disbursement?.verifiedAt)
  flags.push({id:'cdf_awaiting_remittance',level:'review',message:'CDF approved but remittance not yet verified'});
 if(isCdf&&['cdf_funds_received','commission_paid'].includes(String(record.status))&&cdfReceivedMinor===0)
  flags.push({id:'unverified_cdf',level:'critical',message:'CDF status indicates received funds without complete remittance evidence'});
 let receiptSumMinor:number|null=null;
 if(receipts){
  receiptSumMinor=receipts.every(x=>Number.isSafeInteger(x.amountMinor)&&x.amountMinor>=0)
   ?receipts.reduce((n,x)=>n+x.amountMinor,0):null;
  if(!isCdf&&receiptSumMinor!==null&&paidMinor!==null&&receiptSumMinor!==paidMinor)
   flags.push({id:'legacy_receipt_gap',level:'review',message:'Payment ledger and digital receipts differ; reconcile historical or missing installments'});
 }
 return {feeMinor,paidMinor,cdfReceivedMinor,receivedMinor,balanceMinor,fullyEnrolled,flags,receiptSumMinor};
}
