export const LEGACY_MARATHON_EVENT_ID='kasa-life-2027-march';
export type EventStatus='draft'|'planning'|'active'|'completed'|'archived'|'cancelled';
export type MarathonEvent={
 id:string;name:string;preparationStart:string;eventDate:string;closeoutDate:string;
 status:EventStatus;targetRunners:number;registrationFeeMinor:number;currency:'ZMW';
 adminUids:string[];budgetEditorUids:string[];budgetViewerUids:string[];budgetApproverUids:string[];
 revision:number;createdAt:string;createdBy:string;updatedAt:string;updatedBy:string;
 budgetSourceDocument?:string;budgetSourceSha256?:string;budgetSourceVersion?:string;
 budgetCostedTotalMinor?:number;budgetReportedPaidMinor?:number;budgetReportedOutstandingMinor?:number;
 budgetUncountedPricedMinor?:number;budgetSponsorshipTargetMinor?:number;
 budgetContingencyAlreadyIncluded?:boolean;budgetLaunchContingencyMinor?:number;
 budgetArchiveId?:string;budgetWorkingNotes?:string;
 eventVenue?:string;launchDate?:string;launchTime?:string;launchVenue?:string;
};
export const legacyMarathonEvent:MarathonEvent={
 id:LEGACY_MARATHON_EVENT_ID,name:'KASA Life Marathon — March 2027',
 preparationStart:'2026-11-01',eventDate:'2027-03-21',closeoutDate:'2027-04-21',
 status:'planning',targetRunners:5000,registrationFeeMinor:45000,currency:'ZMW',
 adminUids:[],budgetEditorUids:[],budgetViewerUids:[],budgetApproverUids:[],
 revision:0,createdAt:'',createdBy:'',updatedAt:'',updatedBy:''
};
export function taskEventId(task:{eventId?:unknown}):string{
 return typeof task.eventId==='string'&&task.eventId?task.eventId:LEGACY_MARATHON_EVENT_ID;
}
export function isMarathonCalendarDate(value:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function dateWithinEvent(d:string|null|undefined,event:Pick<MarathonEvent,'preparationStart'|'closeoutDate'>){
 return !d||(isMarathonCalendarDate(d)&&d>=event.preparationStart&&d<=event.closeoutDate);
}
export type BudgetStatus='draft'|'submitted'|'approved'|'committed'|'paid'|'void';
export type BudgetLine={
 id:string;eventId:string;category:string;description:string;quantity:number;unitCostMinor:number;
 months:number;plannedMinor:number;actualPaidMinor:number;status:BudgetStatus;
 taskId:string|null;startDate:string|null;endDate:string|null;notes:string;
 revision:number;createdBy:string;createdAt:string;updatedBy:string;updatedAt:string;approvedBy?:string|null;approvedAt?:string|null;
 sourceSection?:number;sourceOfFunds?:string;dueDateText?:string;sourceQuantityLabel?:string;
 sourceUnitCostLabel?:string;sourceTotalCostLabel?:string;sourceClassification?:'costed'|'outside_consolidated'|'within_allocation'|'in_kind'|'tbc'|'free'|'waived';
 reportedEstimateMinor?:number;reportedPaidClaimMinor?:number;
 sourceDocument?:string;sourceDocumentSha256?:string;
};
/** Exact state-machine for budget approval; money changes are separate audited actions. */
export function canTransitionBudgetStatus(from:BudgetStatus,to:BudgetStatus):boolean{
 if(from===to)return true;
 const allowed:Record<BudgetStatus,BudgetStatus[]>={
  draft:['submitted','void'],
  submitted:['draft','approved','void'],
  approved:['draft','committed','paid','void'],
  committed:['approved','paid','void'],
  paid:[],
  void:['draft']
 };
 return allowed[from].includes(to);
}
export function calculatedLineMinor(quantity:number,unitCostMinor:number,months:number):number{
 const value=quantity*unitCostMinor*months;
 if(!Number.isSafeInteger(value)||value<0)throw Error('Budget calculation exceeds supported limits.');
 return value;
}
export function budgetTotals(lines:Pick<BudgetLine,'plannedMinor'|'actualPaidMinor'|'status'>[],targetRunners:number,registrationFeeMinor:number){
 const active=lines.filter(line=>line.status!=='void');
 const plannedMinor=active.reduce((sum,line)=>sum+line.plannedMinor,0);
 const actualPaidMinor=active.reduce((sum,line)=>sum+line.actualPaidMinor,0);
 return {plannedMinor,actualPaidMinor,outstandingMinor:plannedMinor-actualPaidMinor,
  projectedRegistrationMinor:targetRunners*registrationFeeMinor};
}
