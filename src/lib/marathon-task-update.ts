import type {MarathonTask} from './marathon-types';

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
