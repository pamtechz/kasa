import {json} from '@/lib/errors';
export const runtime='nodejs';
/** Binary uploads must go from the browser directly to the owner's provider. */
export async function POST(){
 return json({error:'Server file uploads are disabled. Authorize your Cloudflare storage and use a direct upload.',code:'DIRECT_UPLOAD_REQUIRED'},410);
}
