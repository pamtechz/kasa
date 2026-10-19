import {NextRequest,NextResponse} from 'next/server';
import fs from 'fs';
import path from 'path';
import {db} from '@/lib/firebase-admin';
import {acceptanceLetterConfigSchema,defaultAcceptanceLetterConfig} from '@/lib/acceptance-letter-config';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
 try{
  const doc=await db.collection('settings').doc('acceptanceLetter').get();
  const data=doc.exists?doc.data()||{}:{};
  const parsed=acceptanceLetterConfigSchema.safeParse(data);
  const config=parsed.success?parsed.data:defaultAcceptanceLetterConfig;

  const customUrl=config.enrollmentForm?.url?.trim();
  if(customUrl&&(customUrl.startsWith('http://')||customUrl.startsWith('https://'))){
   return NextResponse.redirect(customUrl,302);
  }

  const templatePath=path.join(process.cwd(),'public','templates','official-enrollment-form-template.pdf');
  if(fs.existsSync(templatePath)){
   const buffer=fs.readFileSync(templatePath);
   return new NextResponse(buffer,{
    status:200,
    headers:{
     'Content-Type':'application/pdf',
     'Content-Disposition':'attachment; filename="Official_KASA_Enrollment_Form.pdf"',
     'Cache-Control':'public, max-age=3600'
    }
   });
  }

  return NextResponse.json({error:'Enrollment form template not found.'},{status:404});
 }catch(e){
  return NextResponse.json({error:e instanceof Error?e.message:'Unable to download enrollment form.'},{status:500});
 }
}
