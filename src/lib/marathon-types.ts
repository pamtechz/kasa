export type MarathonRole='super_admin'|'kasaAdmin'|'kasaOperations'|'kasaEditor'|'kasaReviewer'|'kasaClient';
export type MarathonStatus='todo'|'doing'|'blocked'|'done';
export type MarathonTask={
 id:string;title:string;lead:string;dueDate:string|null;priority:string;urgency:string;importance:string;
 status:MarathonStatus;dependencies:string[];nextStep:string;dateBasis?:string;sourceDeadline?:string;
 cadence?:string;origin?:string;completedAt:string|null;completedBy?:string|null;recordedAt?:string|null;
 evidence?:string;notes?:string;archived?:boolean;revision:number;updatedAt:string;updatedBy:string;
 section?:string;sourceRow?:number;sourceRemarks?:string;dateCorrection?:string|null;
};
