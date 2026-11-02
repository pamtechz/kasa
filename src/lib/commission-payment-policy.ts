/** Commission arithmetic is integer ngwee. A changed admin policy must never
 * reprice an enrollment once its first payout has been recorded. */
export type CommissionMode='progressive'|'full_on_first_payment'|'after_full_enrollment';
export type CommissionRateType='percentage'|'fixed';
export type CommissionPolicy={
 mode:CommissionMode;rateType:CommissionRateType;
 percentageBps:number;fixedMinor:number;version:string
};
export function commissionPolicyFromSettings(value:Record<string,unknown>):CommissionPolicy{
 const mode=value.commissionPaymentMode;
 const rateType=value.commissionRateType;
 const pct=Number(value.commissionPercentBps);
 const fixed=Number(value.commissionAmountPaid);
 return {
  mode:mode==='progressive'||mode==='full_on_first_payment'||mode==='after_full_enrollment'
   ?mode:'after_full_enrollment',
  rateType:rateType==='percentage'?'percentage':'fixed',
  percentageBps:Number.isSafeInteger(pct)&&pct>=0&&pct<=10000?pct:0,
  fixedMinor:Number.isFinite(fixed)&&fixed>=0&&fixed<=50000?Math.round(fixed*100):0,
  version:String(value.commissionPolicyUpdatedAt||'legacy')
 };
}
export function commissionTotalMinor(feeMinor:number,policy:CommissionPolicy):number{
 if(!Number.isSafeInteger(feeMinor)||feeMinor<=0)throw Error('Approved programme fees required');
 const total=policy.rateType==='percentage'
  ?Math.floor(feeMinor*policy.percentageBps/10000):policy.fixedMinor;
 if(!Number.isSafeInteger(total)||total<0||total>5000000)throw Error('Commission exceeds approved limits');
 return total;
}
export function advanceEntitlementMinor(feeMinor:number,paidMinor:number,
 fullMinor:number,mode:CommissionMode):number{
 if(![feeMinor,paidMinor,fullMinor].every(Number.isSafeInteger)
   ||feeMinor<=0||paidMinor<0||paidMinor>feeMinor||fullMinor<0)throw Error('Unreconciled fees or receipt balance');
 if(paidMinor===0||mode==='after_full_enrollment')return 0;
 if(mode==='full_on_first_payment')return fullMinor;
 return Math.min(fullMinor,Math.floor(fullMinor*paidMinor/feeMinor));
}
