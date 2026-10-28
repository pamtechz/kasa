import type {ApplicantRecord} from './types';
import {fundedEnrollment} from './funded-enrollment';

/** Never award commission from accepted status, CDF approval notices, unverified
 * tuition receipts, self-reported enrollment, or historical default rates. */
export type CommissionDecision={eligible:boolean;reason:string;amount:number;trigger:'payment'|'cdf_disbursement'|null};
const money=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0&&Math.abs(v*100-Math.round(v*100))<.000001;
export function commissionDecision(record:Partial<ApplicantRecord>&Record<string,any>):CommissionDecision{
 const deny=(reason:string):CommissionDecision=>({eligible:false,reason,amount:0,trigger:null});
 if(record.formKind!=='student'||!record.agentId)return deny('No valid linked student enrollment and agent referral.');
 const funding=fundedEnrollment(record);
 if(!funding.funded||!funding.channel)return deny(funding.reason);
 const c=record.commission;
 if(!c||!money(c.amount)||c.amount>50000||c.currency!=='ZMW'||!c.approvedAt||
    !record.referralVerified?.at||!record.referralVerified?.by||c.trigger!==funding.channel)
  return deny('Approved commission rate, verified attribution or matching funding trigger is missing.');
 return {eligible:true,reason:funding.reason,amount:c.amount,trigger:funding.channel};
}
