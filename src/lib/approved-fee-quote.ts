/**
 * Validate a saved, approved, immutable, application-specific fee quote.
 * Unquoted legacy applications must be reconciled before any due balance is shown.
 */
export type ApprovedFeeQuote = {
 status:'approved'; programmeId:string; version:string; currency:'ZMW';
 tuition:number; practical:number; administration:number;
 accommodation:number; food:number; total:number;
};
function isMoney(v:unknown):v is number {
 return typeof v==='number' && Number.isFinite(v) && v>=0 && v<=10000000 &&
   Math.abs(v*100-Math.round(v*100))<0.000001;
}
export function readApprovedFeeQuote(input:unknown):ApprovedFeeQuote|null {
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const x=input as Record<string,unknown>;
 if(x.status!=='approved'||x.currency!=='ZMW'||
    typeof x.programmeId!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x.programmeId)||
    typeof x.version!=='string'||x.version.length<1||x.version.length>80)return null;
 const parts=[x.tuition,x.practical,x.administration,x.accommodation,x.food];
 if(!parts.every(isMoney)||!isMoney(x.total))return null;
 const cents=(parts as number[]).reduce((n,v)=>n+Math.round(v*100),0);
 return cents===Math.round(x.total*100)?x as ApprovedFeeQuote:null;
}
