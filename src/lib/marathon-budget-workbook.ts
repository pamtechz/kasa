import type {BudgetLine,BudgetClassification} from './marathon-event-model';

export const budgetClassifications:Record<BudgetClassification,string>={
 costed:'Costed',outside_consolidated:'Outside consolidated total',
 within_allocation:'Within existing allocation',in_kind:'Expected in-kind (not secured)',
 tbc:'TBC — unpriced',free:'Free / pending confirmation',waived:'Waived'
};
export const lineClassification=(line:Pick<BudgetLine,'classification'|'sourceClassification'>):BudgetClassification=>
 line.classification||line.sourceClassification||'costed';

/** Only costed allocations contribute to the cash budget. Source estimates remain visible. */
export function budgetLineAmounts(quantity:number,unitCostMinor:number,months:number,classification:BudgetClassification){
 const estimate=quantity*unitCostMinor*months;
 if(!Number.isSafeInteger(estimate)||estimate<0)throw Error('Budget calculation exceeds supported limits.');
 return {plannedMinor:classification==='costed'?estimate:0,reportedEstimateMinor:estimate};
}
export function budgetCategories(lines:BudgetLine[]){
 const groups=new Map<string,{category:string;planned:number;paid:number;items:number}>();
 for(const line of lines.filter(x=>x.status!=='void')){
  const category=line.category.trim()||'Uncategorised';
  const row=groups.get(category)||{category,planned:0,paid:0,items:0};
  row.planned+=line.plannedMinor;row.paid+=line.actualPaidMinor;row.items++;
  groups.set(category,row);
 }
 return [...groups.values()].sort((a,b)=>b.planned-a.planned||a.category.localeCompare(b.category));
}
export function budgetReview(lines:BudgetLine[]){
 const active=lines.filter(x=>x.status!=='void');
 return {
  unpriced:active.filter(x=>lineClassification(x)==='tbc'),
  outside:active.filter(x=>lineClassification(x)==='outside_consolidated'),
  partners:active.filter(x=>lineClassification(x)==='in_kind'),
  reportedPaid:active.filter(x=>(x.reportedPaidClaimMinor||0)>0),
  outsideMinor:active.filter(x=>lineClassification(x)==='outside_consolidated').reduce((n,x)=>n+(x.reportedEstimateMinor||0),0)
 };
}
export function budgetCsv(lines:BudgetLine[]):string{
 const header=['ID','Category','Item','Treatment','Quantity','Unit cost K','Months','Estimate K','Cash budget K',
  'Recorded paid K','Remaining K','Due / payment schedule','Funding source','Status','Linked activity',
  'Draft-reported paid K (unverified)','Source quantity','Source unit cost','Source total','Notes'];
 const rows=lines.map(line=>[line.id,line.category,line.description,budgetClassifications[lineClassification(line)],
  line.quantity,line.unitCostMinor/100,line.months,(line.reportedEstimateMinor??line.plannedMinor)/100,
  line.plannedMinor/100,line.actualPaidMinor/100,(line.plannedMinor-line.actualPaidMinor)/100,
  line.dueDateText||line.endDate||'',line.sourceOfFunds||'',line.status,line.taskId||'',
  (line.reportedPaidClaimMinor||0)/100,line.sourceQuantityLabel||'',line.sourceUnitCostLabel||'',line.sourceTotalCostLabel||'',line.notes]);
 const safe=(value:unknown)=>{const s=String(value);return '"'+(/^[\s]*[=+\-@]/.test(s)?"'":"")+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+[header,...rows].map(row=>row.map(safe).join(',')).join('\r\n');
}
