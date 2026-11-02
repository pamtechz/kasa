import {fail,json,HttpError} from '@/lib/errors';
import {storageIdentity} from '@/lib/r2-storage';
import {cloudflareAccounts,cloudflareApi} from '@/lib/r2-oauth';
export const runtime='nodejs';
export async function GET(req:Request){
 try{
  const {uid}=await storageIdentity(req),accountId=new URL(req.url).searchParams.get('accountId')||'';
  if(!/^[a-f0-9]{32}$/i.test(accountId))throw new HttpError(400,'Select a Cloudflare account.');
  const accounts=await cloudflareAccounts(uid);
  if(!accounts.some(a=>a.id===accountId))throw new HttpError(403,'Account not authorized.');
  const response=await cloudflareApi(uid,'/accounts/'+accountId+'/r2/buckets?per_page=100');
  const data=await response.json().catch(()=>({})) as {success?:boolean;result?:{buckets?:Array<{name?:string;jurisdiction?:string}>}};
  if(data.success!==true||!Array.isArray(data.result?.buckets))
   throw new HttpError(502,'Unable to list authorized R2 buckets.');
  return json({buckets:data.result!.buckets!.filter(b=>typeof b.name==='string'&&b.name.length<=63)
   .map(b=>({name:b.name,jurisdiction:b.jurisdiction||'default'}))});
 }catch(e){return fail(e);}
}
