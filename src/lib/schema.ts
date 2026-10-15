import {z} from 'zod';
import type {Field,FormSchema} from './types';
import {HttpError} from './errors';
const fieldValidator=z.object({
 id:z.string().min(2).max(90).regex(/^[a-zA-Z0-9_-]+$/),
 label:z.string().trim().min(2).max(180),
 type:z.enum(['text','textarea','email','tel','number','date','select','radio','checkbox','file']),
 required:z.boolean(),
 description:z.string().max(500).optional(),
 placeholder:z.string().max(180).optional(),
 options:z.array(z.string().trim().min(1).max(120)).max(60).optional(),
 condition:z.object({fieldId:z.string(),equals:z.string().max(200)}).optional()
}).strict();
export const formValidator=z.object({
 slug:z.string().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
 title:z.string().trim().min(4).max(180),
 subtitle:z.string().trim().max(500),
 kind:z.enum(['agent','student','custom']),
 published:z.boolean(),
 sections:z.array(z.object({
  id:z.string().regex(/^[a-zA-Z0-9_-]+$/).max(90),
  title:z.string().trim().min(2).max(180),
  description:z.string().max(500).optional(),
  fields:z.array(fieldValidator).max(35)
 }).strict()).min(1).max(15)
}).strict().superRefine((form,ctx)=>{
 const fields=form.sections.flatMap(s=>s.fields);
 const ids=fields.map(f=>f.id);
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Field IDs must be unique.'});
 for(const f of fields){
  if(['select','radio','checkbox'].includes(f.type)&&(!f.options?.length||new Set(f.options).size!==f.options.length))ctx.addIssue({code:'custom',message:`Valid, unique options required for ${f.label}.`});
  if(f.condition && (!ids.includes(f.condition.fieldId)||f.condition.fieldId===f.id||ids.indexOf(f.condition.fieldId)>ids.indexOf(f.id)))
   ctx.addIssue({code:'custom',message:`Invalid condition for ${f.label}: refer only to an earlier field.`});
 }
});
export function parseForm(data:unknown){
 const result=formValidator.safeParse(data);
 if(!result.success)throw new HttpError(400,result.error.issues.map(i=>i.message).slice(0,4).join(' '));
 return result.data;
}
export type Attachment={path:string;fileName:string;contentType:string};
export function cleanAnswers(schema:FormSchema,answers:unknown){
 if(!answers||Array.isArray(answers)||typeof answers!=='object')throw new HttpError(400,'Please complete the form.');
 const values=answers as Record<string,unknown>;
 const clean:Record<string,unknown>={};
 const allowed=new Set(schema.sections.flatMap(s=>s.fields.map(f=>f.id)));
 if(Object.keys(values).some(k=>!allowed.has(k)))throw new HttpError(400,'Form contains unrecognized questions.');
 for(const f of schema.sections.flatMap(s=>s.fields)){
  const visible=!f.condition || String(clean[f.condition.fieldId]??'')===f.condition.equals;
  if(!visible)continue;
  const v=values[f.id];
  const empty=v===undefined||v===null||v===''||(Array.isArray(v)&&v.length===0);
  if(empty){if(f.required)throw new HttpError(400,`Please complete ${f.label}.`);continue;}
  if(f.type==='file'){
   if(!v||typeof v!=='object'||Array.isArray(v))throw new HttpError(400,`Invalid attachment: ${f.label}.`);
   const a=v as Record<string,unknown>;
   if(typeof a.path!=='string'||!/^staging\/[0-9a-f-]{36}\.(pdf|png|jpg)$/i.test(a.path)||typeof a.fileName!=='string'||typeof a.contentType!=='string')
    throw new HttpError(400,`Invalid attachment: ${f.label}.`);
   clean[f.id]={path:a.path,fileName:a.fileName.slice(0,160),contentType:a.contentType};continue;
  }
  if(f.type==='checkbox'){
   if(!Array.isArray(v)||v.length>60||v.some(t=>typeof t!=='string'||!f.options?.includes(t))||new Set(v).size!==v.length)throw new HttpError(400,`Invalid selection: ${f.label}.`);
   clean[f.id]=v;continue;
  }
  if(typeof v!=='string'||v.length>2000)throw new HttpError(400,`Invalid answer: ${f.label}.`);
  const s=v.trim();
  if(f.type!=='textarea'&&s.length>500)throw new HttpError(400,`Answer is too long: ${f.label}.`);
  if(f.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw new HttpError(400,`Invalid email: ${f.label}.`);
  if(f.type==='tel'&&!/^\+?[0-9() \-]{8,20}$/.test(s))throw new HttpError(400,`Invalid phone: ${f.label}.`);
  if(f.type==='number'&&(!Number.isFinite(Number(s))||s===''))throw new HttpError(400,`Invalid number: ${f.label}.`);
  if(f.type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(s))throw new HttpError(400,`Invalid date: ${f.label}.`);
  if(['select','radio'].includes(f.type)&&!f.options?.includes(s))throw new HttpError(400,`Invalid option: ${f.label}.`);
  clean[f.id]=s;
 }
 return clean;
}
export function applicantFingerprint(fields:Field[],values:Record<string,unknown>){
 const identifier=fields.find(f=>['email','tel'].includes(f.type)&&typeof values[f.id]==='string');
 return identifier?String(values[identifier.id]).toLowerCase().replace(/[\s()-]/g,''):null;
}
