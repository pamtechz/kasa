'use client';
import {authHeaders} from '@/lib/firebase-client';

/** Authorize with the verified student session, never a query-string bearer token. */
export async function downloadStudentPdf(
  submissionId:string, kind:'letter'|'enrollment-form', reference:string
):Promise<void>{
  const headers=await authHeaders();
  const response=await fetch(
    `/api/public/submissions/${encodeURIComponent(submissionId)}/${kind}`,
    {headers,cache:'no-store'}
  );
  if(!response.ok){
    const details=await response.json().catch(()=>({}));
    throw new Error(typeof details.error==='string'?details.error:'Document download failed.');
  }
  if(!(response.headers.get('content-type')||'').toLowerCase().includes('application/pdf')){
    throw new Error('Unexpected document response.');
  }
  const objectUrl=URL.createObjectURL(await response.blob());
  const anchor=document.createElement('a');
  anchor.href=objectUrl;
  anchor.download=`KASA-${kind==='letter'?'Acceptance':'Enrollment'}-${reference.replace(/[^a-z0-9-]/gi,'')}.pdf`;
  document.body.appendChild(anchor);
  try{anchor.click();}
  finally{
    anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(objectUrl),60000);
  }
}
