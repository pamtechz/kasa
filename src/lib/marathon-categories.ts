import type {MarathonTask} from './marathon-types';

export const marathonCategories=[
 {id:'planning',order:1,label:'Planning, governance & approvals',section:'1. EVENT PLANNING, GOVERNANCE & APPROVALS'},
 {id:'sponsorship',order:2,label:'Sponsorship, partnerships & fundraising',section:'2. SPONSORSHIP, PARTNERSHIPS & FUNDRAISING'},
 {id:'routes',order:3,label:'Routes, technical & traffic management',section:'3. ROUTE, TECHNICAL & TRAFFIC MANAGEMENT'},
 {id:'registration',order:4,label:'Registration, participant services & race packs',section:'4. REGISTRATION, PARTICIPANT SERVICES & RACE PACKS'},
 {id:'safety',order:5,label:'Medical, safety, security & insurance',section:'5. MEDICAL, SAFETY, SECURITY & INSURANCE'},
 {id:'water',order:6,label:'Water, refreshments & waste management',section:'6. WATER, REFRESHMENTS & WASTE MANAGEMENT'},
 {id:'venue',order:7,label:'Venue, infrastructure & logistics',section:'7. VENUE, INFRASTRUCTURE & LOGISTICS'},
 {id:'awards',order:8,label:'Medals, prizes, certificates & merchandise',section:'8. MEDALS, PRIZES, CERTIFICATES & MERCHANDISE'},
 {id:'marketing',order:9,label:'Marketing, media & communications',section:'9. MARKETING, MEDIA & COMMUNICATIONS'},
 {id:'volunteers',order:10,label:'Officials, staff & volunteers',section:'10. OFFICIALS, STAFF & VOLUNTEERS'},
 {id:'protocol',order:11,label:'Protocol, VIPs & ceremonies',section:'11. PROTOCOL, VIPs & CEREMONIES'},
 {id:'race-day',order:12,label:'Race-day operations',section:'12. RACE-DAY OPERATIONS'},
 {id:'finance',order:13,label:'Finance, procurement & administration',section:'13. FINANCE, PROCUREMENT & ADMINISTRATION'},
 {id:'community',order:14,label:'Environment, community & accessibility',section:'14. ENVIRONMENT, COMMUNITY & ACCESSIBILITY'},
 {id:'reporting',order:15,label:'Post-event reporting & evaluation',section:'15. POST-EVENT REPORTING & EVALUATION'}
] as const;
export type MarathonCategory={id:string;order:number;label:string;section:string};
const unassigned:MarathonCategory={id:'uncategorized',order:16,label:'Needs a category',section:''};
const bySection=new Map<string,MarathonCategory>(marathonCategories.map(c=>[c.section,c]));
export function categoryForSection(section:unknown):MarathonCategory{return typeof section==='string'?bySection.get(section)||unassigned:unassigned;}
export function isMarathonCategorySection(value:unknown):value is string{return typeof value==='string'&&bySection.has(value);}
export function isMarathonCategoryId(value:unknown):value is string{return value===unassigned.id||marathonCategories.some(c=>c.id===value);}
export function categoryForId(id:string):MarathonCategory{return marathonCategories.find(c=>c.id===id)||unassigned;}
export function groupMarathonCategories(tasks:MarathonTask[],includeEmpty=false){
 const groups=new Map<string,{category:MarathonCategory;tasks:MarathonTask[];completed:number}>(marathonCategories.map(category=>[category.id,{category,tasks:[],completed:0}]));
 for(const task of tasks){
  if(task.archived)continue;
  const category=categoryForSection(task.section);
  if(!groups.has(category.id))groups.set(category.id,{category,tasks:[],completed:0});
  const group=groups.get(category.id)!;group.tasks.push(task);if(task.status==='done')group.completed++;
 }
 return [...groups.values()].filter(g=>g.tasks.length||(includeEmpty&&g.category.id!=='uncategorized')).sort((a,b)=>a.category.order-b.category.order);
}
export function matchesMarathonFilters(task:MarathonTask,filters:{category?:string;status?:string;priority?:string;lead?:string;query?:string;focus?:MarathonFocus;today?:string}){
 if(task.archived)return false;
 if(filters.category&&filters.category!=='all'&&categoryForSection(task.section).id!==filters.category)return false;
 if(filters.status&&filters.status!=='all'&&task.status!==filters.status)return false;
 if(filters.focus&&filters.focus!=='all'&&!matchesMarathonFocus(task,filters.focus,filters.today||marathonToday()))return false;
 if(filters.priority&&filters.priority!=='all'&&!task.priority.startsWith(filters.priority))return false;
 if(filters.lead&&filters.lead!=='all'&&task.lead!==filters.lead)return false;
 const needle=[task.id,task.title,task.lead,task.nextStep,task.section,categoryForSection(task.section).label].filter(Boolean).join(' ').toLowerCase();
 return needle.includes((filters.query||'').trim().toLowerCase());
}

export const marathonFocusViews=[
 {id:'all',label:'All actions'},
 {id:'open',label:'Open'},
 {id:'attention',label:'Needs attention'},
 {id:'week',label:'Next 7 days'},
 {id:'done',label:'Completed'}
] as const;
export type MarathonFocus=(typeof marathonFocusViews)[number]['id'];

export function marathonToday(now=new Date()):string{
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lusaka',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const date=Object.fromEntries(parts.map(part=>[part.type,part.value]));
 return date.year+'-'+date.month+'-'+date.day;
}
export function matchesMarathonFocus(task:MarathonTask,focus:MarathonFocus,today:string):boolean{
 if(task.archived)return false;
 if(focus==='all')return true;
 if(focus==='done')return task.status==='done';
 if(task.status==='done')return false;
 if(focus==='open')return true;
 if(focus==='attention')return task.status==='blocked'||task.priority.startsWith('P1')||!!(task.dueDate&&task.dueDate<today);
 if(focus==='week'){
  const end=new Date(Date.parse(today+'T00:00:00Z')+6*86400000).toISOString().slice(0,10);
  return !!task.dueDate&&task.dueDate>=today&&task.dueDate<=end;
 }
 return false;
}
export function marathonFocusCounts(tasks:MarathonTask[],today:string):Record<MarathonFocus,number>{
 const counts:Record<MarathonFocus,number>={all:0,open:0,attention:0,week:0,done:0};
 for(const task of tasks)for(const view of marathonFocusViews)if(matchesMarathonFocus(task,view.id,today))counts[view.id]++;
 return counts;
}
