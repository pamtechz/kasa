import {db,auth} from './_firebase.mjs';

/** Trusted CLI alternative to the one-time web bootstrap; does not expose credentials. */
const email=(process.env.BOOTSTRAP_ADMIN_EMAIL||'').trim().toLowerCase();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
 throw Error('Set BOOTSTRAP_ADMIN_EMAIL to an existing, verified Firebase Authentication email.');
}
const user=await auth.getUserByEmail(email);
if(!user.emailVerified)throw Error('Verify the administrator email before running bootstrap.');
const marker=db.collection('settings').doc('bootstrap');
const profile=db.collection('profiles').doc(user.uid);
let already=false;
await db.runTransaction(async tx=>{
 const [initialized,current]=await Promise.all([tx.get(marker),tx.get(profile)]);
 if(initialized.exists){
  if(initialized.data()?.uid!==user.uid||current.data()?.role!=='super_admin'){
   throw Error('Another administrator already initialized this KASA project.');
  }
  already=true;return;
 }
 if(current.exists&&current.data()?.role==='agent')throw Error('An existing agent account cannot claim administrator privileges.');
 const at=new Date().toISOString();
 tx.create(marker,{uid:user.uid,email,at,method:'trusted_cli'});
 tx.set(profile,{uid:user.uid,email,displayName:user.displayName||email,role:'super_admin',active:true,updatedAt:at},{merge:true});
});
console.log(already?'KASA administrator already initialized.':'KASA first administrator successfully initialized.');
console.log('Next step: sign in to KASA and seed the approved starter content from the authenticated setup dashboard.');
