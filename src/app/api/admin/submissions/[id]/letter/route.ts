import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {db} from '@/lib/firebase-admin';
import {fail,HttpError} from '@/lib/errors';
import {operator} from '@/lib/security';
export const runtime='nodejs';
function ascii(text:string){return text.replace(/[^\x20-\x7e\n]/g,' ');}
function wrap(text:string,size:number,maxWidth:number,font:{widthOfTextAtSize(t:string,n:number):number}){
 const lines:string[]=[];
 for(const paragraph of text.split('\n')){
  if(!paragraph.trim()){lines.push('');continue;}
  let line='';
  for(const word of paragraph.split(/\s+/)){
   const test=line?line+' '+word:word;
   if(line&&font.widthOfTextAtSize(test,size)>maxWidth){lines.push(line);line=word;}else line=test;
  }
  if(line)lines.push(line);
 }
 return lines;
}
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  await operator(req,['super_admin','admin','reviewer']);
  const {id}=await params;const snap=await db.collection('submissions').doc(id).get();
  if(!snap.exists)throw new HttpError(404,'Application not found.');
  const applicant=snap.data()!;
  if(applicant.formKind!=='student'||!['letter_issued','cdf_submitted','cdf_approved','commission_paid'].includes(applicant.status))
   throw new HttpError(403,'A letter can only be generated after KASA has issued admission acceptance.');
  const settings=(await db.collection('settings').doc('operations').get()).data()||{};
  const cfg=settings.acceptanceLetter;
  if(!cfg||!cfg.body||!cfg.nameField||!cfg.courseField)throw new HttpError(400,'Configure the acceptance-letter template and answer field mappings in Settings first.');
  const answer=applicant.answers||{};
  const substitutions:Record<string,string>={
   applicant:String(answer[cfg.nameField]||''),course:String(answer[cfg.courseField]||''),
   intake:String(answer[cfg.intakeField]||''),reference:String(applicant.reference),
   date:new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})
  };
  if(!substitutions.applicant||!substitutions.course)throw new HttpError(400,'Letter field mappings do not match applicant answers.');
  const substitute=(str:string)=>ascii(str.replace(/\{\{(applicant|course|intake|reference|date)\}\}/g,(_,key:string)=>substitutions[key]||''));
  const pdf=await PDFDocument.create();const page=pdf.addPage([595,842]);
  const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const x=65,maxW=465;
  page.drawRectangle({x:0,y:778,width:595,height:64,color:rgb(.07,.24,.17)});
  page.drawText(ascii(settings.organization||'KASA'),{x,y:803,size:23,font:bold,color:rgb(1,1,1)});
  page.drawText('OFFICIAL ADMISSIONS CORRESPONDENCE',{x,y:787,size:9,font:regular,color:rgb(.82,.92,.85)});
  let y=734;
  page.drawText('ACCEPTANCE LETTER',{x,y,size:18,font:bold,color:rgb(.06,.25,.16)});y-=33;
  page.drawText(`Reference: ${ascii(applicant.reference)}`,{x,y,size:10,font:bold,color:rgb(.1,.2,.16)});y-=19;
  page.drawText(`Date: ${substitutions.date}`,{x,y,size:10,font:regular,color:rgb(.22,.3,.25)});y-=42;
  for(const line of wrap(substitute(cfg.body),11,maxW,regular)){
   if(y<115)throw new HttpError(400,'Acceptance-letter text is too long for one page. Shorten it in Settings.');
   if(line)page.drawText(line,{x,y,size:11,font:regular,color:rgb(.18,.25,.21)});
   y-=18;
  }
  y-=32;
  page.drawText('Yours faithfully,',{x,y,size:11,font:regular,color:rgb(.15,.23,.18)});y-=27;
  page.drawText(ascii(cfg.signatory||'Admissions Office'),{x,y,size:11,font:bold,color:rgb(.08,.27,.18)});y-=18;
  page.drawText(ascii(settings.organization||'KASA'),{x,y,size:10,font:regular,color:rgb(.35,.44,.39)});
  page.drawText('This letter confirms institutional admission only; it does not guarantee a CDF bursary.',{x,y:65,size:9,font:regular,color:rgb(.45,.48,.45)});
  page.drawText(ascii(applicant.reference),{x,y:42,size:9,font:regular,color:rgb(.48,.53,.49)});
  const bytes=await pdf.save();
  return new Response(Buffer.from(bytes),{status:200,headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="KASA-Acceptance-${applicant.reference}.pdf"`,'Cache-Control':'private, no-store'}});
 }catch(e){return fail(e);}
}
