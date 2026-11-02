import {db} from '@/lib/firebase-admin';
import {fail,json} from '@/lib/errors';
import {sameOrigin,audit} from '@/lib/security';
import {storageIdentity} from '@/lib/r2-storage';
import {revokeOAuthIssuedToken} from '@/lib/r2-oauth-direct';
export const runtime='nodejs';

/** Disable new token issuance first, revoke the provider-issued S3 tokens,
 * then destroy local OAuth and S3 secrets. Owner objects remain untouched.
 * A provider outage must never block local disconnection.
 */
export async function POST(req:Request){
 try{
  sameOrigin(req);const {uid}=await storageIdentity(req);
  const sessionRef=db.collection('r2OAuthSessions').doc(uid);
  await db.runTransaction(async tx=>{
   const session=await tx.get(sessionRef);
   if(session.exists)tx.update(sessionRef,{status:'disconnecting',updatedAt:new Date().toISOString()});
  });
  const connections=await db.collection('r2Connections').where('ownerUid','==',uid).get();
  const owned=connections.docs.filter(c=>c.data().auth==='oauth');
  let notRevoked=0;
  for(const connection of owned){
   if(!await revokeOAuthIssuedToken(uid,connection.id,String(connection.data().accountId||'')))notRevoked++;
  }
  await db.runTransaction(async tx=>{
   // This removes all stored credentials even if a provider revocation failed.
   const recent=await tx.get(db.collection('r2Connections').where('ownerUid','==',uid));
   tx.delete(sessionRef);
   tx.delete(db.collection('r2OAuthSecrets').doc(uid));
   for(const connection of recent.docs){
    if(connection.data().auth!=='oauth')continue;
    tx.update(connection.ref,{status:'disconnected',updatedAt:new Date().toISOString()});
    tx.delete(db.collection('r2ConnectionSecrets').doc(connection.id));
   }
  });
  await audit(uid,'r2.oauth_disconnected',uid,{tokensNeedingProviderRevocation:notRevoked}).catch(()=>{});
  return json({ok:true,providerRevocationConfirmed:notRevoked===0,tokensNeedingProviderRevocation:notRevoked,
   message:notRevoked
    ?'KASA access is disconnected and local credentials were destroyed. Cloudflare could not confirm revocation of every issued storage token. Review and revoke KASA tokens in your Cloudflare account; they otherwise expire automatically.'
    :'KASA and its previously issued storage tokens were disconnected. Your objects remain in your Cloudflare account.'});
 }catch(e){return fail(e);}
}
