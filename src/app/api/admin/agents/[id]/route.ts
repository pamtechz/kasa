import {db} from '@/lib/firebase-admin';
import {fail,json,HttpError} from '@/lib/errors';
import {operator,audit,sameOrigin,safeText} from '@/lib/security';
export const runtime='nodejs';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){try{
 sameOrigin(req);const admin=await operator(req,['super_admin','admin']);const {id}=await params;
 const body=await req.json();const changes:Record<string,unknown>={updatedAt:new Date().toISOString()};
 if(typeof body.active==='boolean')changes.active=body.active;
 if(body.district!==undefined){const district=safeText(body.district,120);if(district.length<2)throw new HttpError(400,'Valid district required.');changes.district=district;}
 if(Object.keys(changes).length===1)throw new HttpError(400,'No valid changes supplied.');
 const ref=db.collection('profiles').doc(id);const snap=await ref.get();
 if(!snap.exists||snap.data()?.role!=='agent')throw new HttpError(404,'Agent not found.');
 await ref.update(changes);await audit(admin.uid,'agent.updated',id,changes);return json({ok:true});
}catch(e){return fail(e);}}
