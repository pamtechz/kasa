import {db} from './_firebase.mjs';
import {readFileSync} from 'node:fs';
const source=JSON.parse(readFileSync(new URL('../src/data/kasa-starter-content.json',import.meta.url),'utf8'));
const results={programmes:0,announcements:0,skipped:0};
for(const collection of ['programmes','announcements']){
 for(const item of source[collection]){
  const ref=db.collection(collection).doc(item.id);
  if((await ref.get()).exists){results.skipped++;continue;}
  await ref.create({...item,seedSource:source.sourceNotes,updatedAt:new Date().toISOString()});
  results[collection]++;
 }
}
console.log('KASA Firestore seed finished (non-destructive):',JSON.stringify(results));
console.log('Review the source data and published flags in the admin dashboard before advertising applications.');
