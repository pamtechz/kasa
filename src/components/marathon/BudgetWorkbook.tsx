'use client';
import {useState,type KeyboardEvent} from 'react';
import {ArrowDown,ArrowUp,Download,FileSpreadsheet,Plus,Search} from 'lucide-react';
import {budgetCategories,budgetClassifications,budgetReview,lineClassification} from '@/lib/marathon-budget-workbook';
import type {BudgetLine,MarathonEvent} from '@/lib/marathon-event-model';
import styles from './MarathonEventBudget.module.css';

export type BudgetResult={event:MarathonEvent;lines:BudgetLine[];totals:{
 plannedMinor:number;actualPaidMinor:number;outstandingMinor:number;projectedRegistrationMinor:number;
 contingencyMinor:number;totalWithContingencyMinor:number};permissions:{write:boolean;approve:boolean}};
const money=(n:number)=>new Intl.NumberFormat('en-ZM',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100);
const tabs=[['overview','Overview'],['items','Budget sheet'],['funding','Funding & deadlines'],['review','Needs attention']] as const;
type Tab=typeof tabs[number][0];
type Sort='category'|'description'|'plannedMinor'|'actualPaidMinor';
export function BudgetWorkbook({budget,busy,onAdd,onEdit,onUpdate,onExport}:{
 budget:BudgetResult;busy:boolean;onAdd:()=>void;onEdit:(line:BudgetLine)=>void;
 onUpdate:(line:BudgetLine,status:BudgetLine['status'])=>void;onExport:()=>void;
}){
 const [tab,setTab]=useState<Tab>('overview'),[search,setSearch]=useState('');
 const [category,setCategory]=useState(''),[treatment,setTreatment]=useState(''),[status,setStatus]=useState('');
 const [sort,setSort]=useState<Sort>('category'),[descending,setDescending]=useState(false);
 const event=budget.event,review=budgetReview(budget.lines),categories=budgetCategories(budget.lines);
 const visible=budget.lines.filter(line=>(!category||line.category===category)&&(!treatment||lineClassification(line)===treatment)&&
  (!status||line.status===status)&&(!search||[line.description,line.category,line.sourceOfFunds,line.dueDateText,line.notes].some(x=>x?.toLowerCase().includes(search.toLowerCase()))))
  .sort((a,b)=>{const x=a[sort],y=b[sort];return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y)))*(descending?-1:1)||a.id.localeCompare(b.id);});
 const active=visible.filter(x=>x.status!=='void');
 const visiblePlanned=active.reduce((n,x)=>n+x.plannedMinor,0),visiblePaid=active.reduce((n,x)=>n+x.actualPaidMinor,0);
 function changeSort(key:Sort){if(key===sort)setDescending(x=>!x);else{setSort(key);setDescending(false);}}
 function openSheet(filter?:string){setCategory(filter||'');setTreatment('');setStatus('');setSearch('');setTab('items');}
 function tabKey(e:KeyboardEvent<HTMLButtonElement>,index:number){
  const next=e.key==='ArrowRight'?(index+1)%tabs.length:e.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;
  if(next===null)return;e.preventDefault();setTab(tabs[next][0]);document.getElementById('budget-tab-'+tabs[next][0])?.focus();
 }
 function sortHeading(key:Sort,label:string){return <th scope="col" aria-sort={sort===key?(descending?'descending':'ascending'):'none'}>
  <button className={styles.sortButton} onClick={()=>changeSort(key)}>{label}{sort===key&&(descending?<ArrowDown size={13}/>:<ArrowUp size={13}/>)}</button></th>;}
 return <section className={styles.workbook} aria-label="Event budget workbook">
  <div className={styles.workbookHeader}><div className={styles.workbookTitle}><FileSpreadsheet size={26}/><div><h2>Event budget</h2><p>{event.name} <span className={styles.draftLabel}>Working budget</span></p></div></div>
   <div className={styles.actions}><button className={styles.button+' '+styles.secondary} disabled={!budget.lines.length} onClick={onExport}><Download size={16}/>Export for Excel (.csv)</button>
    {budget.permissions.write&&<button className={styles.button} disabled={busy} onClick={onAdd}><Plus size={17}/>Add item</button>}</div>
  </div>
  <div className={styles.summaryStrip}>
   <div><small>Current budget</small><strong>K{money(budget.totals.totalWithContingencyMinor)}</strong><span>{event.budgetContingencyAlreadyIncluded?'Includes launch contingency':'Includes event contingency'}</span></div>
   <div><small>Actual payments recorded</small><strong>K{money(budget.totals.actualPaidMinor)}</strong><span>Verified entries only</span></div>
   <div><small>Remaining direct allocation</small><strong>K{money(budget.totals.outstandingMinor)}</strong><span>Active costs less recorded payments</span></div>
   <div><small>Items needing quotations</small><strong>{review.unpriced.length}</strong><span>Not included in cash totals</span></div>
  </div>
  <div className={styles.tabs} role="tablist" aria-label="Budget worksheets">{tabs.map(([key,label],i)=><button key={key} id={'budget-tab-'+key} role="tab" aria-selected={tab===key}
   aria-controls={'budget-panel-'+key} tabIndex={tab===key?0:-1} onKeyDown={e=>tabKey(e,i)} onClick={()=>setTab(key)}>{label}{key==='items'&&<span>{budget.lines.length}</span>}</button>)}</div>
  <div role="tabpanel" id={'budget-panel-'+tab} aria-labelledby={'budget-tab-'+tab} tabIndex={0} className={styles.sheetPanel}>
   {tab==='overview'&&<>
    <div className={styles.sectionHeading}><div><h3>Budget by category</h3><p>Choose a category to open its items in the budget sheet.</p></div><button className={styles.textButton} onClick={()=>openSheet()}>View all items</button></div>
    <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Category budget summary"><table className={styles.categoryTable}><thead><tr><th scope="col">Category</th><th scope="col">Items</th><th scope="col">Budget (K)</th><th scope="col">Paid (K)</th><th scope="col">Remaining (K)</th></tr></thead>
     <tbody>{categories.map(row=><tr key={row.category}><th scope="row"><button className={styles.textButton} onClick={()=>openSheet(row.category)}>{row.category}</button></th><td>{row.items}</td><td>{money(row.planned)}</td><td>{money(row.paid)}</td><td>{money(row.planned-row.paid)}</td></tr>)}</tbody>
     <tfoot><tr><th scope="row">Direct costs total</th><td>{budget.lines.filter(x=>x.status!=='void').length}</td><td>{money(budget.totals.plannedMinor)}</td><td>{money(budget.totals.actualPaidMinor)}</td><td>{money(budget.totals.outstandingMinor)}</td></tr></tfoot></table></div>
    {!categories.length&&<div className={styles.empty}>No budget items yet. Add the first item to start planning.</div>}
    <div className={styles.notesArea}><h3>Budget basis</h3><p>Totals use active items from the selected event. Voided items are excluded. Items within an allocation and expected partner support stay visible without adding a second cost.</p>
     <p>{event.budgetContingencyAlreadyIncluded?<>Launch contingency of K{money(event.budgetLaunchContingencyMinor||0)} is already included. No second contingency is added.</>:<>Event contingency: K{money(budget.totals.contingencyMinor)}.</>}</p>
     {event.budgetSourceDocument&&<details><summary>Source document and planning notes</summary><p>{event.budgetSourceDocument}</p><p>{event.budgetWorkingNotes}</p><p>Event venue: {event.eventVenue||'To be confirmed'}. Launch: {event.launchDate||'To be confirmed'} at {event.launchVenue||'To be confirmed'}.</p></details>}
    </div>
   </>}
   {(tab==='items'||tab==='funding')&&<>
    <div className={styles.sheetToolbar}>
     <label className={styles.search}><Search size={17}/><span className={styles.srOnly}>Search budget items</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items, funding or deadlines"/></label>
     <label className={styles.filter}>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All categories</option>{[...new Set(budget.lines.map(x=>x.category))].sort().map(c=><option key={c}>{c}</option>)}</select></label>
     <label className={styles.filter}>Cost treatment<select value={treatment} onChange={e=>setTreatment(e.target.value)}><option value="">All treatments</option>{Object.entries(budgetClassifications).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label className={styles.filter}>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{['draft','submitted','approved','committed','paid','void'].map(s=><option key={s}>{s}</option>)}</select></label>
     {(search||category||treatment||status)&&<button className={styles.textButton} onClick={()=>{setSearch('');setCategory('');setTreatment('');setStatus('');}}>Clear filters</button>}
    </div>
    {tab==='funding'&&<div className={styles.projections}><div><small>Registration revenue target</small><strong>K{money(budget.totals.projectedRegistrationMinor)}</strong><p>{event.targetRunners.toLocaleString()} runners × K{money(event.registrationFeeMinor)}</p></div><div><small>Sponsorship fundraising target (unconfirmed)</small><strong>{event.budgetSponsorshipTargetMinor===undefined?'Not set':'K'+money(event.budgetSponsorshipTargetMinor)}</strong><p>Targets and partner pledges are not received cash.</p></div></div>}
    <p className={styles.sheetHint}>Scroll across for more columns. Click an underlined column heading to sort. Use Edit to save an item.</p>
    <div className={styles.spreadsheetScroll} tabIndex={0} role="region" aria-label={tab==='items'?'Itemised budget sheet':'Funding and payment schedule'}>
     <table className={styles.spreadsheet}><thead>
      <tr className={styles.columnLetters} aria-hidden="true">{(tab==='items'?['','A','B','C','D','E','F','G','H','I','J','K']:['','A','B','C','D','E','F','G','H','I']).map((x,i)=><td key={i}>{x}</td>)}</tr>
      <tr><th scope="col">#</th>{sortHeading('description','Item')}{sortHeading('category','Category')}
       {tab==='items'?<><th scope="col">Cost treatment</th><th scope="col">Qty</th><th scope="col">Rate (K)</th><th scope="col">Periods</th>{sortHeading('plannedMinor','Cash budget (K)')}{sortHeading('actualPaidMinor','Paid (K)')}<th scope="col">Remaining (K)</th></>:<><th scope="col">Funding source</th><th scope="col">Due / schedule</th>{sortHeading('plannedMinor','Cash budget (K)')}<th scope="col">Cost treatment</th><th scope="col">Estimate (K)</th></>}
       <th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
      <tbody>{visible.map((line,i)=><tr key={line.id} className={line.status==='void'?styles.voidRow:undefined}><th scope="row">{i+1}</th><td><strong>{line.description}</strong>{line.taskId&&<small>Activity: {line.taskId}</small>}{line.classification&&<small>Updated treatment</small>}</td><td>{line.category}</td>
       {tab==='items'?<><td><span className={styles.treatment}>{budgetClassifications[lineClassification(line)]}</span>{lineClassification(line)==='outside_consolidated'&&<small>Estimate: K{money(line.reportedEstimateMinor||0)}</small>}</td><td className={styles.number}>{line.classification?line.quantity:(line.sourceQuantityLabel||line.quantity)}</td><td className={styles.number}>{lineClassification(line)==='costed'?money(line.unitCostMinor):'—'}</td><td className={styles.number}>{line.months}</td><td className={styles.number}>{money(line.plannedMinor)}</td><td className={styles.number}>{money(line.actualPaidMinor)}</td><td className={styles.number}>{money(line.plannedMinor-line.actualPaidMinor)}</td></>:<><td>{line.sourceOfFunds||'To be confirmed'}</td><td>{line.dueDateText||line.endDate||'To be confirmed'}</td><td className={styles.number}>{money(line.plannedMinor)}</td><td>{budgetClassifications[lineClassification(line)]}</td><td className={styles.number}>{line.reportedEstimateMinor?money(line.reportedEstimateMinor):'—'}</td></>}
       <td><span className={styles.status}>{line.status}</span></td><td><div className={styles.rowActions}>
        {budget.permissions.write&&line.status==='draft'&&<><button disabled={busy} onClick={()=>onEdit(line)}>Edit</button><button disabled={busy} onClick={()=>onUpdate(line,'submitted')}>Submit</button></>}
        {budget.permissions.write&&line.status==='submitted'&&<button disabled={busy} onClick={()=>onUpdate(line,'draft')}>Return to draft</button>}
        {budget.permissions.approve&&line.status==='submitted'&&<button disabled={busy} onClick={()=>onUpdate(line,'approved')}>Approve</button>}
        {budget.permissions.approve&&line.status==='approved'&&<button disabled={busy} onClick={()=>onUpdate(line,'committed')}>Commit</button>}
        {budget.permissions.approve&&['approved','committed'].includes(line.status)&&<button disabled={busy} onClick={()=>onUpdate(line,'paid')}>Record payment</button>}
        {budget.permissions.approve&&['approved','committed','void'].includes(line.status)&&<button disabled={busy} onClick={()=>onUpdate(line,'draft')}>Reopen draft</button>}
        {budget.permissions.approve&&line.status!=='void'&&line.actualPaidMinor===0&&<button disabled={busy} onClick={()=>onUpdate(line,'void')}>Void</button>}
        {!budget.permissions.write&&!budget.permissions.approve&&<span>View only</span>}
       </div></td></tr>)}</tbody>
      <tfoot><tr><th colSpan={tab==='items'?7:5}>Filtered active totals</th><td className={styles.number}>{money(visiblePlanned)}</td>{tab==='items'&&<><td className={styles.number}>{money(visiblePaid)}</td><td className={styles.number}>{money(visiblePlanned-visiblePaid)}</td></>}<td colSpan={tab==='items'?2:4}>Voided rows excluded</td></tr></tfoot>
     </table>
     {!visible.length&&<div className={styles.empty}>No items match these filters.</div>}
    </div>
    <div className={styles.sheetFooter}><span>{visible.length} of {budget.lines.length} items · ZMW</span><span>Export includes all items and source notes.</span>{budget.permissions.write&&<button className={styles.textButton} disabled={busy} onClick={onAdd}><Plus size={15}/>Add another row</button>}</div>
   </>}
   {tab==='review'&&<>
    <div className={styles.sectionHeading}><div><h3>Decisions and confirmations</h3><p>These figures stay separate from the current cash budget.</p></div></div>
    <div className={styles.reviewGrid}>
     <div><small>Draft-reported paid (Finance reconciliation pending)</small><strong>K{money(event.budgetReportedPaidMinor||0)}</strong><p>Reported by the source document. Verify against Finance records before recording a payment.</p></div>
     <div><small>Outside consolidated total</small><strong>K{money(review.outsideMinor)}</strong><p>{review.outside.length} priced items need an inclusion decision.</p><button className={styles.textButton} onClick={()=>{openSheet();setTreatment('outside_consolidated');}}>Review priced items</button></div>
     <div><small>Quotations required</small><strong>{review.unpriced.length} items</strong><p>Unpriced items have no cash allocation yet.</p><button className={styles.textButton} onClick={()=>{openSheet();setTreatment('tbc');}}>Review unpriced items</button></div>
     <div><small>Expected partner support</small><strong>{review.partners.length} items</strong><p>Confirm scope and delivery with each partner.</p><button className={styles.textButton} onClick={()=>{setTab('funding');setCategory('');setSearch('');setStatus('');setTreatment('in_kind');}}>View partner support</button></div>
    </div>
    {event.budgetReportedOutstandingMinor!==undefined&&<p className={styles.sheetHint}>Source draft reports outstanding K{money(event.budgetReportedOutstandingMinor)}. This is a planning claim from that draft, not a live creditor balance.</p>}
   </>}
  </div>
 </section>;
}
