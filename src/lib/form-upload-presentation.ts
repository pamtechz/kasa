/** Replace retired provider URL instructions without renaming historical field IDs. */
type UploadLabel={type:string;label:string;description?:string;placeholder?:string;required?:boolean};
export function presentUploadField<T extends UploadLabel>(field:T):T{
 if(!['file','image'].includes(field.type)||!/cloudinary/i.test([field.label,field.description,field.placeholder].join(' ')))return field;
 const label=field.label.replace(/\s*\([^)]*cloudinary[^)]*\)/gi,'').replace(/cloudinary\s*(?:url|link)?/gi,'file').trim();
 const originalAlternative=field.description?.match(/You can also [\s\S]*$/i)?.[0]||'';
 return {...field,label:label||'Attachment',placeholder:'',description:
  (field.required?'':'Optional. ')+(field.type==='image'?'Choose a JPG or PNG image from your device. ':'Choose a PDF, JPG or PNG from your device. ')+
  'Authorize your external storage to upload it.'+(originalAlternative?' '+originalAlternative:'')};
}
export function presentFormUploads<T extends {sections:{fields:UploadLabel[]}[]}>(form:T):T{
 if(!Array.isArray(form.sections))return form;
 return {...form,sections:form.sections.map(section=>({...section,fields:section.fields.map(presentUploadField)}))};
}
