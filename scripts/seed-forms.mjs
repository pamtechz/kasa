import {db} from './_firebase.mjs';
import {readFileSync} from 'node:fs';
const forms=JSON.parse(readFileSync(new URL('./starter-templates.json',import.meta.url),'utf8'));
for(const form of forms){
 const snapshot=await db.collection('forms').where('slug','==',form.slug).limit(1).get();
 if(!snapshot.empty){console.log('Already exists:',form.slug);continue;}
 const now=new Date().toISOString();
 await db.collection('forms').add({...form,version:1,createdAt:now,updatedAt:now,published:false});
 console.log('Seeded draft:',form.slug);
}
