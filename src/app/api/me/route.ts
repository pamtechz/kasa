import {operator} from '@/lib/security';
import {fail,json} from '@/lib/errors';
export const runtime='nodejs';
export async function GET(req:Request){try{return json({profile:await operator(req,['super_admin','admin','reviewer','agent'])});}catch(e){return fail(e);}}
