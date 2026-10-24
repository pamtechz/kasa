import type {MarathonTask} from './marathon-types';

export function preserveSourceCategory(before:{section?:unknown;sourceSnapshot?:unknown},changes:{section?:unknown}):Record<string,unknown>{
 const snapshot=before.sourceSnapshot;
 if(changes.section===undefined||!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||Object.prototype.hasOwnProperty.call(snapshot,'section'))return {};
 // Older imports did not save the source category in their baseline. Capture
 // it before the first user category edit so later imports retain that choice.
 return {sourceSnapshot:{...snapshot,section:typeof before.section==='string'?before.section:null}};
}

export function completionChanges(before:Pick<MarathonTask,'status'|'completedAt'|'completedBy'|'recordedAt'>,changes:Partial<MarathonTask>,actor:string,now:string):Record<string,unknown>{
 const finalStatus=changes.status??before.status;
 if(finalStatus==='done'){
  if(before.status==='done'&&!changes.completedAt)return {completedAt:before.completedAt||null};
  const completedAt=changes.completedAt||before.completedAt||now;
  if(before.status!=='done'||completedAt!==before.completedAt){
   return {completedAt,completedBy:actor,recordedAt:now};
  }
  return {completedAt};
 }
 if(changes.completedAt!==undefined&&changes.completedAt!==null)throw new Error('Completion date requires Done status.');
 if(before.status==='done'&&changes.status)return {completedAt:null,completedBy:null,recordedAt:now};
 return {};
}
