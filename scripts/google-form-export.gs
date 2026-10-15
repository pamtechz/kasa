/**
 * Attach to the original Google Form under Extensions > Apps Script.
 * Run exportKasaFormSchema(), and copy the result from Execution log.
 * This script READS the form. It does not modify or submit responses.
 * Unsupported questions are preserved as text placeholders for review.
 */
function exportKasaFormSchema() {
  const form = FormApp.getActiveForm();
  if (!form) throw new Error('Run this script from the original form.');
  const slug = form.getTitle().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const result = { slug, title: form.getTitle(), subtitle: form.getDescription() || '', kind: 'student', published: false, sections: [] };
  let section = {id: 'section-1', title: 'Applicant information', description:'', fields:[]};
  const sections = [section];
  form.getItems().forEach((item, index) => {
    const t = item.getType();
    if (t === FormApp.ItemType.PAGE_BREAK) {
      section = {id:'section-'+(sections.length+1),title:item.getTitle()||'Next section',description:item.getHelpText()||'',fields:[]};
      sections.push(section);
      return;
    }
    if (t === FormApp.ItemType.SECTION_HEADER) {
      section = {id:'section-'+(sections.length+1),title:item.getTitle()||'Section',description:item.getHelpText()||'',fields:[]};
      sections.push(section);
      return;
    }
    if (t === FormApp.ItemType.IMAGE || t === FormApp.ItemType.VIDEO) return;
    const f = {id:'question-'+(index+1),label:item.getTitle()||'Question '+(index+1),description:item.getHelpText()||'',type:'text',required:false};
    try {f.required = item.asTextItem().isRequired();} catch (e) {
      try {f.required = item.asMultipleChoiceItem().isRequired();} catch (e2) {
        try {f.required = item.asParagraphTextItem().isRequired();} catch (e3) {}
      }
    }
    if (t === FormApp.ItemType.TEXT) {f.type=/email/i.test(f.label)?'email':(/phone|whatsapp|mobile/i.test(f.label)?'tel':'text');f.required=item.asTextItem().isRequired();}
    else if (t === FormApp.ItemType.PARAGRAPH_TEXT) {f.type='textarea';f.required=item.asParagraphTextItem().isRequired();}
    else if (t === FormApp.ItemType.MULTIPLE_CHOICE) {f.type='radio';const v=item.asMultipleChoiceItem();f.required=v.isRequired();f.options=v.getChoices().map(x=>x.getValue());}
    else if (t === FormApp.ItemType.CHECKBOX) {f.type='checkbox';const v=item.asCheckboxItem();f.required=v.isRequired();f.options=v.getChoices().map(x=>x.getValue());}
    else if (t === FormApp.ItemType.LIST) {f.type='select';const v=item.asListItem();f.required=v.isRequired();f.options=v.getChoices().map(x=>x.getValue());}
    else if (t === FormApp.ItemType.DATE) {f.type='date';f.required=item.asDateItem().isRequired();}
    // Google Apps Script Forms service may not expose file-upload item details. Review these placeholders manually.
    else {f.description=(f.description+' [Check original Google Form type: '+t+']').trim();}
    section.fields.push(f);
  });
  result.sections = sections.filter(s=>s.fields.length>0);
  if (!result.sections.length) result.sections=[{id:'section-1',title:'Applicant details',fields:[{id:'applicant-name',label:'Full name',type:'text',required:true}]}];
  console.log(JSON.stringify(result,null,2));
}
