import {db,auth} from './_firebase.mjs';
const email=process.env.BOOTSTRAP_ADMIN_EMAIL;
if(!email)throw Error('Provide BOOTSTRAP_ADMIN_EMAIL for a pre-existing Firebase Authentication user.');
const user=await auth.getUserByEmail(email);
if(!user.emailVerified)throw Error('Verify bootstrap admin email before granting privileges.');
await db.collection('profiles').doc(user.uid).set({uid:user.uid,email:user.email,displayName:user.displayName||email,role:'super_admin',active:true,updatedAt:new Date().toISOString()},{merge:true});
console.log('Bootstrap admin role applied to the specified existing Firebase Auth user.');
