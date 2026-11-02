import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {readTuitionReceipt} from '@/lib/tuition-receipt-server';
import {fail,HttpError} from '@/lib/errors';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  if(!/^[a-f0-9]{64}$/.test(id))throw new HttpError(400,'Invalid receipt identifier.');
  const data=await readTuitionReceipt(req,id);
  const pdf=await PDFDocument.create(),page=pdf.addPage([595,842]);
  const normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({x:0,y:758,width:595,height:84,color:rgb(.07,.24,.18)});
  page.drawText('KASA | OFFICIAL TUITION RECEIPT',{x:45,y:798,font:bold,size:17,color:rgb(1,1,1)});
  page.drawText('Payment recorded by KASA Finance',{x:46,y:777,font:normal,size:11,color:rgb(.92,.98,.94)});
  const pairs:[string,string][]=[
   ['Receipt ID',id],
   ['Application reference',String(data.applicationReference||'')],
   ['Payment amount','ZMW '+(Number(data.amountMinor)/100).toFixed(2)],
   ['Paid to date','ZMW '+(Number(data.totalPaidMinor)/100).toFixed(2)],
   ['Approved fee total','ZMW '+(Number(data.feeTotalMinor)/100).toFixed(2)],
   ['Remaining balance','ZMW '+(Math.max(0,Number(data.feeTotalMinor)-Number(data.totalPaidMinor))/100).toFixed(2)],
   ['Payment method',String(data.paymentMethod||'')],
   ['Transaction / receipt ID',String(data.transactionId||'')],
   ['Recorded at',String(data.recordedAt||'')],
   ['Enrollment verification','Separate admissions review required']
  ];
  let y=726;
  for(const [label,value] of pairs){
   page.drawText(label,{x:48,y,font:bold,size:10,color:rgb(.14,.22,.18)});
   page.drawText(value.replace(/[^\x20-\x7E]/g,' ').slice(0,74),{x:210,y,font:normal,size:10});
   y-=42;
  }
  page.drawLine({start:{x:47,y:145},end:{x:548,y:145},color:rgb(.68,.73,.7),thickness:1});
  page.drawText('This receipt confirms a tuition payment entered by authorized KASA Finance staff.',{x:48,y:125,font:normal,size:9});
  page.drawText('It does not independently establish bank settlement, admission or referral commission.',{x:48,y:109,font:normal,size:9});
  page.drawText('Keep this record and the original bank/mobile-money payment confirmation.',{x:48,y:92,font:normal,size:9});
  const bytes=await pdf.save();
  return new Response(new Uint8Array(bytes),{headers:{
   'Content-Type':'application/pdf',
   'Content-Disposition':`attachment; filename="KASA-Tuition-Receipt-${id.slice(0,12)}.pdf"`,
   'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
  }});
 }catch(e){return fail(e);}
}
