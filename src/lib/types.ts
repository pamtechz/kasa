export type FieldType = 'text'|'textarea'|'email'|'tel'|'number'|'date'|'select'|'radio'|'checkbox'|'file';
export type Field = {
  id:string; label:string; type:FieldType; required:boolean;
  description?:string; placeholder?:string; options?:string[];
  condition?:{fieldId:string;equals:string};
};
export type Section = {id:string;title:string;description?:string;fields:Field[]};
export type FormKind = 'agent'|'student'|'custom';
export type FormSchema = {id:string;slug:string;title:string;subtitle:string;kind:FormKind;
  published:boolean;version:number;sections:Section[];createdAt?:string;updatedAt?:string};
export type SubmissionStatus = 'submitted'|'under_review'|'needs_information'|'accepted'|'rejected'|'letter_issued'|'cdf_submitted'|'cdf_approved'|'commission_paid';
export type ApplicantRecord = {id:string;reference:string;formId:string;formTitle:string;formKind:FormKind;
  formVersion:number;status:SubmissionStatus;answers:Record<string,unknown>;agentId:string|null;
  submittedAt:string;updatedAt:string;cdfVerification?:{reference:string;verifiedAt:string;verifiedBy:string};
  formSnapshot?:Pick<FormSchema,'title'|'slug'|'sections'|'version'>;
  commission?:{amount:number;currency:string;paidAt?:string;paymentReference?:string};
};
export type Role = 'super_admin'|'admin'|'reviewer'|'agent';
export type Profile = {uid:string;email:string;displayName:string;role:Role;active:boolean;agentCode?:string;district?:string};
