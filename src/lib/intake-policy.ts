import {z} from 'zod';
export const policySchema=z.object({
 applicationsOpen:z.boolean(),
 opensAt:z.string().datetime({offset:true}).nullable(),
 closesAt:z.string().datetime({offset:true}).nullable(),
 formOverrides:z.record(z.boolean()),
 cdfRequiredDocuments:z.array(z.object({
  id:z.string().regex(/^[a-z][a-z0-9-]{1,60}$/),
  label:z.string().trim().min(3).max(120)
 })).max(20),
 notice:z.string().trim().max(500)
}).strict().superRefine((v,ctx)=>{
 if(v.opensAt&&v.closesAt&&Date.parse(v.opensAt)>=Date.parse(v.closesAt))
  ctx.addIssue({code:'custom',message:'Opening date must precede closing date'});
 const ids=v.cdfRequiredDocuments.map(d=>d.id);
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Document IDs must be unique'});
});
export type IntakePolicy=z.infer<typeof policySchema>;
export const initialIntake:IntakePolicy={
 applicationsOpen:false,opensAt:null,closesAt:null,formOverrides:{},
 cdfRequiredDocuments:[
  {id:'identity-document',label:'Proof of applicant identity'},
  {id:'cdf-application-evidence',label:'Evidence of CDF bursary application submission'},
  {id:'cdf-approval-notice',label:'Official CDF sponsorship approval notice'}
 ],
 notice:'Applications will open when KASA approves the intake.'
};
export function normalizedIntake(input:unknown):IntakePolicy{
 const p=policySchema.safeParse(input);return p.success?p.data:initialIntake;
}
export function intakeWindow(p:IntakePolicy,slug:string,now=Date.now()){
 if(!p.applicationsOpen)return {open:false,reason:p.notice||'Applications are currently closed.'};
 if(p.formOverrides[slug]===false)return {open:false,reason:'This application form is closed.'};
 if(p.opensAt&&now<Date.parse(p.opensAt))return {open:false,reason:'Applications have not opened yet.'};
 if(p.closesAt&&now>=Date.parse(p.closesAt))return {open:false,reason:'The application deadline has passed.'};
 return {open:true,reason:''};
}
