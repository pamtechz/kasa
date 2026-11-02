import {operator} from '@/lib/security';
import {fail,json} from '@/lib/errors';
import {platformR2} from '@/lib/r2-storage';
import {r2EncryptionReady} from '@/lib/r2-crypto';
import {signR2Url,validateR2Address} from '@/lib/r2-signing';

export const runtime='nodejs';
export const dynamic='force-dynamic';

// An administrator can see missing variable NAMES, never values or tokens.
const PLATFORM_KEYS=[
 'R2_PLATFORM_ACCOUNT_ID','R2_PLATFORM_BUCKET',
 'R2_PLATFORM_ACCESS_KEY_ID','R2_PLATFORM_SECRET_ACCESS_KEY'
] as const;

export async function GET(req:Request){
 try{
  await operator(req,['super_admin','admin']);
  const missing=PLATFORM_KEYS.filter(key=>!process.env[key]?.trim());
  const configured=missing.length===0;
  let connectivity:'not_checked'|'not_configured'|'ready'|'rejected'|'unreachable'|'invalid_configuration'=
   configured?'not_checked':'not_configured';
  if(configured&&new URL(req.url).searchParams.get('verify')==='1'){
   try{
    const c=platformR2();
    if(!c)throw Error('Missing R2 configuration');
    validateR2Address(c.accountId,c.bucket,c.jurisdiction);
    const url=signR2Url(c,'GET','',30,undefined,{'list-type':'2','max-keys':'1'});
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000),cache:'no-store'});
    connectivity=response.ok?'ready':'rejected';
   }catch(e){
    connectivity=e instanceof Error&&/(Invalid R2|Cloudflare account ID|bucket name|jurisdiction)/i.test(e.message)
      ?'invalid_configuration':'unreachable';
   }
  }
  return json({platformConfigured:configured,missingVariables:missing,
   byobEncryptionConfigured:r2EncryptionReady(),connectivity},200);
 }catch(e){return fail(e);}
}
