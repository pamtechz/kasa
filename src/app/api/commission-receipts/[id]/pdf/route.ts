import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {db} from '@/lib/firebase-admin';
import {operator} from '@/lib/security';
import {fail,HttpError} from '@/lib/errors';
export const runtime='nodejs';

const staffRoles=['super_admin','admin','reviewer','finance'];
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actor=await operator(req,['super_admin','admin','reviewer','finance','agent','student']);
  const {id}=await params;
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(id))throw new HttpError(400,'Invalid receipt ID.');
  const snap=await db.collection('commissionReceipts').doc(id).get();
  if(!snap.exists)throw new HttpError(404,'Commission receipt not found.');
  const item=snap.data()!;
  if(!staffRoles.includes(actor.role)&&item.recipientUid!==actor.uid)
   throw new HttpError(403,'You may only download your own payout receipt.');
  const pdf=await PDFDocument.create();
  const page=pdf.addPage([595,842]);const font=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const draw=(label:string,value:unknown,y:number)=>{
   const left=String(label).slice(0,35),right=String(value??'—').replace(/[^\x20-\x7E]/g,' ').slice(0,84);
   page.drawText(left,{x:48,y,font:bold,size:10,color:rgb(.15,.24,.2)});
   page.drawText(right,{x:210,y,font,size:10,color:rgb(.13,.18,.17),maxWidth:340});
  };
  page.drawRectangle({x:0,y:763,width:595,height:79,color:rgb(.07,.24,.18)});
  page.drawText('KASA | COMMISSION PAYMENT RECEIPT',{x:46,y:794,font:bold,size:17,color:rgb(1,1,1)});
  page.drawText('Recipient acknowledgement and transfer record',{x:47,y:775,font,size:10,color:rgb(.85,.93,.88)});
  const status=String(item.status||'awaiting_confirmation');
  let y=735;
  for(const [label,value] of [
   ['Receipt number',snap.id],
   ['Application reference',item.reference],
   ['Recorded amount','ZMW '+(Number(item.amountMinor)/100).toFixed(2)],
   ['Transaction ID',item.transactionId],
   ['Payment recorded on',item.recordedAt],
   ['Recipient acknowledgement',status.replace(/_/g,' ').toUpperCase()],
   ['Acknowledged on',item.confirmedAt||'Not yet confirmed'],
   ['Acknowledged amount',item.confirmedAmountMinor==null?'Pending':'ZMW '+(Number(item.confirmedAmountMinor)/100).toFixed(2)],
   ['Recipient-reported reference',item.confirmedTransactionId||item.reportedTransactionId||'Pending'],
   ['Discrepancy recorded',item.disputedAt||'None']
  ] as [string,unknown][]) {draw(label,value,y);y-=40;}
  if(item.discrepancyNote){page.drawText('Dispute notes:',{x:48,y:y-8,font:bold,size:10});y-=28;
   const words=String(item.discrepancyNote).replace(/[^\x20-\x7E]/g,' ').split(/\s+/);let line='';
   for(const word of words){if((line+' '+word).length>87){page.drawText(line,{x:48,y,font,size:9});y-=16;line=word;}else line+=(line?' ':'')+word;}
   if(line)page.drawText(line.slice(0,87),{x:48,y,font,size:9});
  }
  page.drawLine({start:{x:46,y:125},end:{x:549,y:125},thickness:1,color:rgb(.65,.71,.67)});
  page.drawText('This document records the KASA payment entry and recipient response.',{x:48,y:108,font,size:9});
  page.drawText('It is not independent bank settlement evidence or a substitute for a provider statement.',{x:48,y:94,font,size:9});
  if(status!=='confirmed')page.drawText('Recipient confirmation is outstanding or disputed.',{x:48,y:80,font:bold,size:9,color:rgb(.58,.22,.1)});
  const bytes=await pdf.save();
  return new Response(new Uint8Array(bytes),{headers:{
    'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="KASA-Commission-Receipt-${id}.pdf"`,
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
  }});
 }catch(e){return fail(e);}
}
