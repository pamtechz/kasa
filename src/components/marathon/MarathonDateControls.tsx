import type {ChecklistDateFilters,ChecklistDateMode,ChecklistSort} from '@/lib/marathon-date-filters';
import {checklistDateError} from '@/lib/marathon-date-filters';

export function MarathonDateControls({sort,filters,onSortChange,onFiltersChange}:{
 sort:ChecklistSort;
 filters:ChecklistDateFilters;
 onSortChange:(value:ChecklistSort)=>void;
 onFiltersChange:(value:ChecklistDateFilters)=>void;
}){
 const change=(next:Partial<ChecklistDateFilters>)=>onFiltersChange({...filters,...next});
 const error=checklistDateError(filters);
 return <div className="ml-date-tools" role="group" aria-label="Checklist due-date filters and sorting">
  <label>Sort by
   <select aria-label="Sort checklist" value={sort} onChange={e=>onSortChange(e.target.value as ChecklistSort)}>
    <option value="priority">Priority, then due date</option>
    <option value="due-asc">Due date: earliest first</option>
    <option value="due-desc">Due date: latest first</option>
   </select>
  </label>
  <label>Due date period
   <select aria-label="Filter by due-date period" value={filters.mode} onChange={e=>change({mode:e.target.value as ChecklistDateMode})}>
    <option value="all">All due dates</option>
    <option value="month">By month</option>
    <option value="year">By year</option>
    <option value="range">Custom date range</option>
   </select>
  </label>
  {filters.mode==='month'&&<label>Month
   <input type="month" aria-label="Checklist month" required value={filters.month} onChange={e=>change({month:e.target.value})}/>
  </label>}
  {filters.mode==='year'&&<label>Year
   <input type="number" aria-label="Checklist year" min="1900" max="2100" step="1" inputMode="numeric" value={filters.year} onChange={e=>change({year:e.target.value})}/>
  </label>}
  {filters.mode==='range'&&<>
   <label>From <input type="date" aria-label="Checklist from date" value={filters.from} onChange={e=>change({from:e.target.value})}/></label>
   <label>To <input type="date" aria-label="Checklist to date" min={filters.from||undefined} value={filters.to} onChange={e=>change({to:e.target.value})}/></label>
  </>}
  {error&&<p className="ml-date-error" role="alert">{error}</p>}
 </div>;
}
