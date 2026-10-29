import type {MarathonTask} from './marathon-types';

export type ChecklistSort='priority'|'due-asc'|'due-desc';
export type ChecklistDateMode='all'|'month'|'year'|'range';
export type ChecklistDateFilters={mode:ChecklistDateMode;month:string;year:string;from:string;to:string};

// Deadline dates are calendar days, not instants. Compare YYYY-MM-DD in the
// local calendar without converting to the machine's timezone.
function validDay(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00.000Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}

export function checklistDateError(filters:ChecklistDateFilters):string|null{
 switch(filters.mode){
  case 'all':return null;
  case 'month':return /^\d{4}-(0[1-9]|1[0-2])$/.test(filters.month)?null:'Choose a valid month.';
  case 'year':return /^\d{4}$/.test(filters.year)?null:'Enter a four-digit year.';
  case 'range':
   if(!filters.from&&!filters.to)return 'Choose at least a start or an end date.';
   if((filters.from&&!validDay(filters.from))||(filters.to&&!validDay(filters.to)))return 'Enter valid calendar dates.';
   if(filters.from&&filters.to&&filters.from>filters.to)return 'Start date must be on or before end date.';
   return null;
  default:return 'Choose a valid date filter.';
 }
}

export function matchesChecklistDueDate(task:Pick<MarathonTask,'dueDate'>,filters:ChecklistDateFilters):boolean{
 if(filters.mode==='all')return true;
 if(checklistDateError(filters)||!validDay(task.dueDate))return false;
 const due=task.dueDate;
 switch(filters.mode){
  case 'month':return due.slice(0,7)===filters.month;
  case 'year':return due.slice(0,4)===filters.year;
  case 'range':return (!filters.from||due>=filters.from)&&(!filters.to||due<=filters.to);
  default:return false;
 }
}

function priorityRank(value:string):number{return value.startsWith('P1')?0:value.startsWith('P2')?1:2;}

export function sortChecklistTasks<T extends Pick<MarathonTask,'id'|'priority'|'dueDate'>>(tasks:readonly T[],sort:ChecklistSort):T[]{
 return [...tasks].sort((a,b)=>{
  const rank=priorityRank(a.priority)-priorityRank(b.priority);
  const first=validDay(a.dueDate)?a.dueDate:null;
  const second=validDay(b.dueDate)?b.dueDate:null;
  if(sort==='priority')return rank||(first||'9999-99-99').localeCompare(second||'9999-99-99')||a.id.localeCompare(b.id);
  // Unknown/invalid due dates always follow dated actions, even in descending order.
  if(!first||!second){
   if(first&&!second)return -1;
   if(!first&&second)return 1;
   return rank||a.id.localeCompare(b.id);
  }
  const dateOrder=first.localeCompare(second);
  return (sort==='due-desc'?-dateOrder:dateOrder)||rank||a.id.localeCompare(b.id);
 });
}
