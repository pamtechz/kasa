import type {Field} from './types';

/**
 * The contact fingerprint is supplied by cleanAnswers / applicantFingerprint.
 * Additional choices distinguish legitimate re-applications for other
 * courses or future intakes from repeated applications to the same intake.
 * Field IDs and published course titles are administrator-controlled.
 */
export function enrollmentScope(fields:Field[],answers:Record<string,unknown>):string{
 const selected=fields
  .filter(field=>field.optionsSource==='programmes'||field.optionsSource==='intakes')
  .map(field=>({
   source:field.optionsSource as 'programmes'|'intakes',
   fieldId:field.id,
   value:typeof answers[field.id]==='string'
    ?String(answers[field.id]).trim().toLocaleLowerCase('en')
    :''
  }))
  .sort((a,b)=>a.source.localeCompare(b.source)||a.fieldId.localeCompare(b.fieldId));
 return JSON.stringify(selected);
}
export function scopedFingerprint(formId:string,contact:string,fields:Field[],answers:Record<string,unknown>):string{
 return JSON.stringify([formId,contact,enrollmentScope(fields,answers)]);
}
