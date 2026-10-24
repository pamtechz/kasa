import Link from 'next/link';
import {ArrowUpRight,Layers3} from 'lucide-react';
import {groupMarathonCategories} from '@/lib/marathon-categories';
import type {MarathonTask} from '@/lib/marathon-types';

export function MarathonCategoryBoard({tasks}:{tasks:MarathonTask[]}){
 return <div className="ml-category-grid">{groupMarathonCategories(tasks,true).map(({category,tasks,completed})=>{
  const percent=tasks.length?Math.round(completed/tasks.length*100):0;
  return <Link key={category.id} href={'/marthon/operations?category='+category.id} className={'ml-category-card'+(category.id==='uncategorized'?' ml-category-unassigned':'')} aria-label={'Open '+category.label+' category'}>
   <div className="ml-category-card-top"><span className="ml-category-number">{category.id==='uncategorized'?<Layers3 size={17}/>:String(category.order).padStart(2,'0')}</span><span>{tasks.length} {tasks.length===1?'action':'actions'}</span><ArrowUpRight size={18}/></div>
   <h2>{category.label}</h2><div className="ml-category-readiness"><span>{completed} completed · {tasks.length-completed} open</span><b>{percent}%</b></div>
   <progress value={completed} max={tasks.length||1} aria-label={category.label+': '+completed+' of '+tasks.length+' completed'}/><span className="ml-category-open">View actions <ArrowUpRight size={15}/></span>
  </Link>;
 })}</div>;
}
