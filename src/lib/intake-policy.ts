import {z} from 'zod';
export const policySchema=z.object({
 applicationsOpen:z.boolean(),
 opensAt:z.string().datetime({offset:true}).nullable(),
 closesAt:z.string().datetime({offset:true}).nullable(),
 formOverrides:z.record(z.boolean()),
 intakes:z.array(z.object({id:z.string().regex(/^[a-z0-9-]{3,80}$/),label:z.string().trim().min(3).max(120),active:z.boolean()})).max(24).default([]),
 cdfRequiredDocuments:z.array(z.object({
  id:z.string().regex(/^[a-z][a-z0-9-]{1,60}$/),
  label:z.string().trim().min(3).max(120)
 })).max(20),
 notice:z.string().trim().max(500),
 maxApplicants:z.number().int().min(1).max(50000).nullable().optional(),
 autoApproveSelfFunded:z.boolean().default(false).optional(),
 autoApproveCdf:z.boolean().default(true).optional()
}).strict().superRefine((v,ctx)=>{
 if(v.opensAt&&v.closesAt&&Date.parse(v.opensAt)>=Date.parse(v.closesAt))
  ctx.addIssue({code:'custom',message:'Opening date must precede closing date'});
 const intakeIds=v.intakes.map(intake=>intake.id);
 if(new Set(intakeIds).size!==intakeIds.length)
  ctx.addIssue({code:'custom',message:'Intake IDs must be unique.'});
 const activeNames=v.intakes.filter(intake=>intake.active).map(intake=>intake.label.trim().toLowerCase());
 if(new Set(activeNames).size!==activeNames.length)
  ctx.addIssue({code:'custom',message:'Active intake names must be unique.'});
  const ids=v.cdfRequiredDocuments.map(d=>d.id);
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Document IDs must be unique'});
});
export type IntakePolicy=z.infer<typeof policySchema>;
export const initialIntake:IntakePolicy={
 applicationsOpen:false,opensAt:null,closesAt:null,formOverrides:{},intakes:[],
 cdfRequiredDocuments:[
  {id:'identity-document',label:'Proof of applicant identity'},
  {id:'cdf-application-evidence',label:'Evidence of CDF bursary application submission'},
  {id:'cdf-approval-notice',label:'Official CDF sponsorship approval notice'}
 ],
 notice:'Applications will open when KASA approves the intake.',
 maxApplicants:null,autoApproveSelfFunded:false,autoApproveCdf:true
};
export function normalizedIntake(input:unknown):IntakePolicy{
 const p=policySchema.safeParse(input);return p.success?p.data:initialIntake;
}
export function intakeWindow(p:IntakePolicy,slug:string,now=Date.now(),totalApplicantsCount?:number){
 if(p.maxApplicants&&totalApplicantsCount!==undefined&&totalApplicantsCount>=p.maxApplicants)return {open:false,reason:'Enrollment capacity has been reached for this intake window. The system is no longer accepting new applications.'};
 if(!p.applicationsOpen)return {open:false,reason:p.notice||'Applications are currently closed.'};
 if(p.formOverrides[slug]===false)return {open:false,reason:'This application form is closed.'};
 if(p.opensAt&&now<Date.parse(p.opensAt))return {open:false,reason:'Applications have not opened yet.'};
 if(p.closesAt&&now>=Date.parse(p.closesAt))return {open:false,reason:'The application deadline has passed.'};
 return {open:true,reason:''};
}
