import {z} from 'zod';
export const automationEvents=['submitted','under_review','needs_information','accepted','rejected','letter_issued','cdf_submitted','cdf_approved','cdf_funds_received','payment_verified','commission_paid'] as const;
export const automationRuleSchema=z.object({
 id:z.string().min(2).max(70).regex(/^[a-zA-Z0-9_-]+$/),
 name:z.string().trim().min(2).max(100),
 event:z.enum(automationEvents),
 enabled:z.boolean(),
 recipient:z.enum(['admin','reviewer','agent']),
 template:z.string().trim().min(3).max(600)
}).strict();
export const automationSchema=z.object({rules:z.array(automationRuleSchema).max(30)}).strict().superRefine((v,ctx)=>{
 const ids=v.rules.map(r=>r.id);
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Automation IDs must be unique.'});
});
export type AutomationConfig=z.infer<typeof automationSchema>;
export const defaultAutomations:AutomationConfig={rules:[
 {id:'new-application',name:'New application review',event:'submitted',enabled:true,recipient:'admin',template:'Application {{reference}} was received and is awaiting review.'},
 {id:'agent-eligible',name:'Commission eligibility recorded',event:'cdf_approved',enabled:true,recipient:'admin',template:'Review the eligibility and commission record for {{reference}}.'},
 {id:'tuition-eligible',name:'Paid enrollment verified',event:'payment_verified',enabled:true,recipient:'admin',template:'A student enrollment payment was verified for {{reference}}.'}
]};
export function formatNotification(template:string,reference:string){
 return template.replaceAll('{{reference}}',reference).slice(0,800);
}
