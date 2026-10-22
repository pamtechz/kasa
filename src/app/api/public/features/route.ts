import {publicFeatureFlags} from '@/lib/feature-policy';
import {fail,json} from '@/lib/errors';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){
 try{return json({features:await publicFeatureFlags()});}
 catch(error){return fail(error);}
}
