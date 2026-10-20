import {z} from 'zod';
import type {Field,FormSchema} from './types';
import {HttpError} from './errors';
const fieldValidator=z.object({
 id:z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/),
 label:z.string().trim().min(1).max(50000),
 type:z.enum(['text','textarea','email','tel','number','date','select','radio','checkbox','file','image']),
 required:z.boolean(),
 description:z.string().max(50000).optional(),
 placeholder:z.string().max(50000).optional(),
 options:z.array(z.string().trim().max(50000)).max(500).optional(),
 optionsSource:z.enum(['programmes','intakes']).optional(),
 condition:z.object({fieldId:z.string(),equals:z.string().max(50000)}).optional()
}).passthrough();
export const formValidator=z.object({
 slug:z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
 title:z.string().trim().min(1).max(50000),
 subtitle:z.string().trim().max(50000),
 kind:z.enum(['agent','student','custom']),
 published:z.boolean(),
 sections:z.array(z.object({
  id:z.string().regex(/^[a-zA-Z0-9_-]+$/).max(120),
  title:z.string().trim().min(1).max(50000),
  description:z.string().max(50000).optional(),
  fields:z.array(fieldValidator).max(100)
 }).passthrough()).min(1).max(50)
}).passthrough().superRefine((form,ctx)=>{
 const fields=form.sections.flatMap(s=>s.fields);
 const ids=fields.map(f=>f.id);
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Field IDs must be unique.'});
 for(const f of fields){
  if(['select','radio','checkbox'].includes(f.type)&&!f.optionsSource&&(!f.options||f.options.length===0)){
   ctx.addIssue({code:'custom',message:`Options required for ${f.label}.`});
  }
  if(f.condition && (!ids.includes(f.condition.fieldId)||f.condition.fieldId===f.id||ids.indexOf(f.condition.fieldId)>ids.indexOf(f.id))){
   ctx.addIssue({code:'custom',message:`Invalid condition for ${f.label}: refer only to an earlier field.`});
  }
 }
});
export function sanitizeFormPayload(data: unknown): Record<string, unknown> {
 if (!data || typeof data !== 'object') return {};
 const obj = { ...(data as Record<string, unknown>) };

 if (typeof obj.title !== 'string') obj.title = String(obj.title || 'Untitled Form').trim();
 if (typeof obj.subtitle !== 'string') obj.subtitle = String(obj.subtitle || '').trim();
 if (typeof obj.slug !== 'string' || !obj.slug.trim()) {
  obj.slug = String(obj.title).toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
 } else {
  obj.slug = String(obj.slug).toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'form-slug';
 }
 if (!['agent', 'student', 'custom'].includes(String(obj.kind))) obj.kind = 'custom';
 obj.published = Boolean(obj.published);

 if (Array.isArray(obj.sections)) {
  obj.sections = obj.sections.map((s: unknown, sIdx: number) => {
   if (!s || typeof s !== 'object') return s;
   const sec = { ...(s as Record<string, unknown>) };
   sec.id = String(sec.id || `section-${sIdx + 1}`).trim().replace(/[^a-zA-Z0-9_-]+/g, '-') || `section-${sIdx + 1}`;
   sec.title = String(sec.title || `Section ${sIdx + 1}`).trim();
   if (sec.description === null || sec.description === undefined) delete sec.description;
   else sec.description = String(sec.description);

   if (Array.isArray(sec.fields)) {
    sec.fields = sec.fields.map((f: unknown, fIdx: number) => {
     if (!f || typeof f !== 'object') return f;
     const field = { ...(f as Record<string, unknown>) };
     field.id = String(field.id || `field-${sIdx + 1}-${fIdx + 1}`).trim().replace(/[^a-zA-Z0-9_-]+/g, '-') || `field-${sIdx + 1}-${fIdx + 1}`;
     field.label = String(field.label || `Question ${fIdx + 1}`).trim();
     field.required = Boolean(field.required);

     const validTypes = ['text', 'textarea', 'email', 'tel', 'number', 'date', 'select', 'radio', 'checkbox', 'file', 'image'];
     if (!validTypes.includes(String(field.type))) field.type = 'text';

     if (field.description === null || field.description === undefined) delete field.description;
     else field.description = String(field.description);

     if (field.placeholder === null || field.placeholder === undefined) delete field.placeholder;
     else field.placeholder = String(field.placeholder);

     if (Array.isArray(field.options)) {
      field.options = field.options.map((opt: unknown) => String(opt ?? '').trim()).filter(Boolean);
     } else if (field.options === null || field.options === undefined) {
      delete field.options;
     }

     if (field.optionsSource && !['programmes', 'intakes'].includes(String(field.optionsSource))) {
      delete field.optionsSource;
     }

     if (field.condition && typeof field.condition === 'object') {
      const cond = field.condition as Record<string, unknown>;
      const fieldId = String(cond.fieldId || '').trim();
      const equals = String(cond.equals ?? '').trim();
      if (fieldId) {
       field.condition = { fieldId, equals };
      } else {
       delete field.condition;
      }
     } else {
      delete field.condition;
     }

     return field;
    });
   }
   return sec;
  });
 }

 return obj;
}

export function parseForm(data: unknown) {
 const sanitized = sanitizeFormPayload(data);
 const result = formValidator.safeParse(sanitized);
 if (!result.success) {
  console.error('Form validation error details:', result.error.issues);
  throw new HttpError(400, result.error.issues.map(i => `${i.message}`).slice(0, 4).join('; '));
 }
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
  if(f.type==='image'){
   if(typeof v!=='string'||!v.trim())throw new HttpError(400,`Invalid image URL: ${f.label}.`);
   const s=v.trim();
   if(!/^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\/.+/i.test(s))
    throw new HttpError(400,`Uploading images must be from https://console.cloudinary.com/app strictly (URL must start with https://res.cloudinary.com/): ${f.label}.`);
   clean[f.id]=s;continue;
  }

  if(f.type==='checkbox'){
   if(!Array.isArray(v)||v.length>60||v.some(t=>typeof t!=='string'||!f.options?.includes(t))||new Set(v).size!==v.length)throw new HttpError(400,`Invalid selection: ${f.label}.`);
   clean[f.id]=v;continue;
  }
  if(typeof v!=='string'||v.length>50000)throw new HttpError(400,`Invalid answer: ${f.label}.`);
  const s=v.trim();
  if(f.type!=='textarea'&&s.length>5000)throw new HttpError(400,`Answer is too long: ${f.label}.`);
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
 if(!identifier)return null;
 const value=String(values[identifier.id]).trim().toLowerCase();
 // Hyphens and plus signs are meaningful in email addresses; do not collapse
 // distinct addresses into the same applicant fingerprint.
 return identifier.type==='email'?value:value.replace(/[\s()-]/g,'');
}
