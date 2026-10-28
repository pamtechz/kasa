import type {Field,FormSchema} from './types';
export function visibleApplicationFields(fields:Field[],answers:Record<string,unknown>){
 return fields.filter(f=>!f.condition||String(answers[f.condition.fieldId]??'')===f.condition.equals);
}
export function sectionIssue(fields:Field[],answers:Record<string,unknown>):{fieldId:string;message:string}|null{
 for(const f of visibleApplicationFields(fields,answers)){
  const v=answers[f.id],empty=v==null||(typeof v==='string'&&!v.trim())||(Array.isArray(v)&&!v.length);
  if(f.required&&empty)return {fieldId:f.id,message:'Please complete '+f.label+'.'};
  if(empty)continue;
  if(['select','radio'].includes(f.type)&&!f.options?.includes(String(v)))return {fieldId:f.id,message:'Choose an available option for '+f.label+'.'};
  if(f.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)))return {fieldId:f.id,message:'Enter a valid email address.'};
  if(f.type==='tel'&&!/^\+?[0-9() \-]{8,20}$/.test(String(v)))return {fieldId:f.id,message:'Enter a valid phone number.'};
 }
 return null;
}
export function applicationDraftKey(form:Pick<FormSchema,'slug'|'version'>){return 'kasa-application:'+form.slug+':v'+form.version;}
export function inputAutocomplete(field:Field){
 if(field.type==='email')return 'email';if(field.type==='tel')return 'tel';
 if(/full.?name/i.test(field.id+' '+field.label))return 'name';
 if(/address/i.test(field.label))return 'street-address';
 return undefined;
}
