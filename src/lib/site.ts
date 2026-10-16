import {z} from 'zod';
const text=z.string().trim();
const item=z.object({title:text.min(1).max(120),description:text.max(500)});
const metric=z.object({value:text.min(1).max(80),label:text.max(100)});
export const siteSchema=z.object({
 organization:text.min(2).max(120),subtitle:text.max(120),badge:text.max(130),
 heroTitle:text.min(5).max(140),heroEmphasis:text.max(100),heroDescription:text.max(1000),
 heroCardTitle:text.max(160),heroCardDescription:text.max(300),
 metrics:z.array(metric).min(1).max(6),
 howEyebrow:text.max(120),howTitle:text.max(180),howDescription:text.max(1000),
 steps:z.array(item).min(1).max(8),
 aboutTitle:text.max(180),aboutDescription:text.max(2000),aboutValues:z.array(item).max(8),
 contactTitle:text.max(180),contactDescription:text.max(800),
 contactEmail:z.union([z.literal(''),z.string().email().max(220)]),
 contactPhone:text.max(60),
 ctaEyebrow:text.max(100),ctaTitle:text.max(180),ctaDescription:text.max(900),
 privacyText:text.max(5000).optional(),termsText:text.max(5000).optional(),
 bootstrapTitle:text.min(5).max(140).optional(),bootstrapDescription:text.max(900).optional(),bootstrapSteps:z.array(text.min(10).max(350)).min(1).max(8).optional(),
 footer:text.max(300)
}).strict();
export type SiteSettings=z.infer<typeof siteSchema>;
export const defaultSite:SiteSettings={
 organization:'KASA',subtitle:'Kamaila Academics, Sports and Apprenticeship',
 badge:'2027 RECRUITMENT & ADMISSIONS',
 heroTitle:'Opportunity begins',heroEmphasis:'in every district.',
 heroDescription:"Join KASA's district enrollment network. Help young people access practical training and understand the official CDF application process.",
 heroCardTitle:'Your district. Real impact.',heroCardDescription:'Students • Agents • KASA',
 metrics:[{value:'District-wide',label:'Community outreach'},{value:'CDF guidance',label:'Official applications'},{value:'Verified',label:'Commission eligibility'}],
 howEyebrow:'A SIMPLE, VERIFIED PROCESS',howTitle:'From first contact to enrolment',
 howDescription:'Students and prospective agents apply online. KASA reviews applications, documents admission decisions and tracks verified outcomes.',
 steps:[
  {title:'Register online',description:'Apply through the published KASA form on your phone or computer.'},
  {title:'KASA reviews',description:'KASA evaluates eligibility and issues appropriate acceptance letters.'},
  {title:'Track the outcome',description:'Verified payment or an official CDF approval can qualify an attributed referral for commission.'}
 ],
 aboutTitle:'Practical learning for real opportunities',
 aboutDescription:'Kamaila Academics, Sports and Apprenticeship develops skills in agriculture, sports and cooperative development through practical training.',
 aboutValues:[{title:'Head',description:'Knowledge, reasoning and learning.'},{title:'Heart',description:'Integrity, care and community.'},{title:'Hand',description:'Practical skills for life and work.'}],
 contactTitle:'Contact KASA',contactDescription:'Contact the admissions team for assistance with applications, courses and recruitment.',
 contactEmail:'',contactPhone:'',
 ctaEyebrow:'BUILD COMMUNITY OPPORTUNITIES',ctaTitle:'Represent KASA in your district.',
 ctaDescription:'Agents may earn commission only on independently verified student enrollment payments or officially approved CDF sponsorship. No agent can guarantee CDF approval or charge for CDF application forms.',
 privacyText:'KASA uses submitted contact, course, identity and supporting document information for admissions assessment, enrollment administration, student support, verified government sponsorship processes and attributable agent referrals. Only authorized staff access applicant records. Information is stored in the KASA Firebase-backed system. Contact KASA for questions or requests about your records; a formal institutional retention schedule should be published before live enrollment.',
 termsText:'Submitting an application does not guarantee admission or Constituency Development Fund sponsorship. CDF decisions are made by the authorized government bodies. Applicants must provide accurate information and the required documentation. Only payments made through approved KASA channels and independently verified official sponsorship decisions can establish successful enrollment. Agents must not demand unofficial CDF application fees or promise government approval.',
 bootstrapTitle:'Initialize your KASA administrator account',
 bootstrapDescription:'Secure one-time institutional setup. The nominated administrator must sign in with a verified Firebase Authentication email before activating their account.',
 bootstrapSteps:['Create your Firebase Authentication account using the authorized administrator email.','Verify your email address and sign in to KASA.','Initialize the first administrator account after authentication and security checks pass.','Review the programme catalogue, application forms, policies and intake dates before opening applications.'],
 footer:'KASA · Kamaila Academics, Sports and Apprenticeship'
};
export function sanitizeSite(data:unknown):SiteSettings{
 const parsed=siteSchema.safeParse(data);
 return parsed.success?{...defaultSite,...parsed.data}:defaultSite;
}
