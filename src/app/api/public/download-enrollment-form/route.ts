import {NextRequest,NextResponse} from 'next/server';
import fs from 'fs';
import path from 'path';
import {generateEnrollmentFormPdf} from '@/lib/pdf-enrollment-form';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(_req:NextRequest){
 try{
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

  // Generate clean 3-page blank enrollment form PDF dynamically
  const pdfBytes = await generateEnrollmentFormPdf({
   reference: 'BLANK-OFFICIAL-FORM',
   applicationDate: new Date().toLocaleDateString('en-GB'),
   intakeAndYear: '2027 Intake',
   programmeTitle: '____________________________________________________',
   fullNames: '____________________________________________________',
   dob: 'DD/MM/YYYY',
   gender: 'Male / Female',
   nationality: 'Zambian',
   nrcNumber: '____________________',
   mobileNumber: '____________________',
   whatsappNumber: '____________________',
   email: '________________________________________',
   residentialAddress: '____________________________________________________',
   district: '____________________',
   province: '____________________',
   highestGrade: 'Grade 9 / Grade 12 / Certificate',
   schoolInstitution: '________________________________________',
   qualificationYear: '2025',
   guardianName: '________________________________________',
   guardianRelationship: 'Parent / Guardian',
   guardianMobile: '____________________',
   sponsorName: 'CDF / Self-Funded'
  });

  return new NextResponse(Buffer.from(pdfBytes),{
   status:200,
   headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':'attachment; filename="Official_KASA_Enrollment_Form.pdf"',
    'Cache-Control':'public, max-age=3600'
   }
  });
 }catch(e){
  return NextResponse.json({error:e instanceof Error?e.message:'Unable to download enrollment form.'},{status:500});
 }
}
