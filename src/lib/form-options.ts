import 'server-only';
import {db} from './firebase-admin';
import {loadIntake} from './intake-server';
import {presentFormUploads} from './form-upload-presentation';
import type {FormSchema} from './types';
export async function populateDynamicOptions(form:FormSchema):Promise<FormSchema>{
 const uses=form.sections.flatMap(s=>s.fields).map(f=>f.optionsSource);
 const [programmes,intakes]=await Promise.all([
  uses.includes('programmes')?db.collection('programmes').where('published','==',true).limit(150).get():null,
  uses.includes('intakes')?loadIntake():null
 ]);
 const courses=programmes?.docs.map(d=>String(d.data().title||'')).filter(Boolean).sort()||[];
 const intakeNames=intakes?.intakes.filter(x=>x.active).map(x=>x.label)||[];
 return presentFormUploads({...form,sections:form.sections.map(section=>({...section,fields:section.fields.map(field=>({
  ...field,...(field.optionsSource?{options:field.optionsSource==='programmes'?courses:intakeNames}:{})
 }))}))});
}
