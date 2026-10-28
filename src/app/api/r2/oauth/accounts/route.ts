import {fail,json} from '@/lib/errors';
import {storageIdentity} from '@/lib/r2-storage';
import {cloudflareAccounts} from '@/lib/r2-oauth';
export const runtime='nodejs';
export async function GET(req:Request){
 try{const {uid}=await storageIdentity(req);return json({accounts:await cloudflareAccounts(uid)});}
 catch(e){return fail(e);}
}
