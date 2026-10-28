type StorageConfiguration={platformAvailable:boolean;connections:{id:string;status:string}[]};
/** Keep the user's destination whenever it is still available after refresh. */
export function selectR2Destination(current:string,config:StorageConfiguration):string{
 // First-time users with an active BYOB bucket should default to their own storage.
 // An explicitly selected platform destination remains honored until changed.
 if(!current)return config.connections.find(c=>c.status==='active')?.id||
  (config.platformAvailable?'platform':'');
 if(current==='platform'&&config.platformAvailable)return current;
 if(config.connections.some(c=>c.id===current&&c.status==='active'))return current;
 return config.platformAvailable?'platform':config.connections.find(c=>c.status==='active')?.id||'';
}
