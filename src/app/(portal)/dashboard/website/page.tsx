'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Save,Plus,Trash2,ExternalLink} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {defaultSite,type SiteSettings} from '@/lib/site';
type Key=keyof SiteSettings;
type Editable={key:Key;label:string;multiline?:boolean};
const groups:{title:string;fields:Editable[]}[]=[
 {title:'Organization and branding',fields:[{key:'organization',label:'Short organization name'},{key:'subtitle',label:'Full organization name'},{key:'footer',label:'Footer information'}]},
 {title:'Homepage hero',fields:[{key:'badge',label:'Announcement'},{key:'heroTitle',label:'Headline'},{key:'heroEmphasis',label:'Highlighted headline text'},{key:'heroDescription',label:'Introduction',multiline:true},{key:'heroCardTitle',label:'Illustration headline'},{key:'heroCardDescription',label:'Illustration caption'}]},
 {title:'How it works',fields:[{key:'howEyebrow',label:'Section label'},{key:'howTitle',label:'Section heading'},{key:'howDescription',label:'Section description',multiline:true}]},
 {title:'About us',fields:[{key:'aboutTitle',label:'Heading'},{key:'aboutDescription',label:'Description',multiline:true}]},
 {title:'Privacy and applications policy',fields:[{key:'privacyText',label:'Privacy notice',multiline:true},{key:'termsText',label:'Application terms',multiline:true}]},
 {title:'Contact details',fields:[{key:'contactTitle',label:'Heading'},{key:'contactDescription',label:'Description',multiline:true},{key:'contactEmail',label:'Public email'},{key:'contactPhone',label:'Public phone number'}]},
 {title:'Agents and recruitment campaign',fields:[{key:'ctaEyebrow',label:'Campaign label'},{key:'ctaTitle',label:'Campaign heading'},{key:'ctaDescription',label:'Commission disclosure and invitation',multiline:true}]}
];
export default function Website(){
 const [site,setSite]=useState<SiteSettings>(defaultSite),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{api<{site:SiteSettings}>('/api/admin/site').then(x=>setSite(x.site)).catch(e=>setError(e.message));},[]);
 const update=(key:Key,value:string)=>setSite(prev=>({...prev,[key]:value}));
 const editItem=(key:'steps'|'aboutValues'|'metrics',index:number,field:'title'|'description'|'value'|'label',value:string)=>{
  setSite(prev=>({...prev,[key]:prev[key].map((x,i)=>i===index?{...x,[field]:value}:x)}));
 };
 const removeItem=(key:'steps'|'aboutValues'|'metrics',index:number)=>setSite(prev=>({...prev,[key]:prev[key].filter((_,i)=>i!==index)}));
 const addItem=(key:'steps'|'aboutValues'|'metrics')=>setSite(prev=>({...prev,[key]:[...prev[key],key==='metrics'?{value:'New metric',label:'Description'}:{title:'New item',description:'Description'}]}));
 async function save(){setBusy(true);setError('');setMessage('');
  try{await api('/api/admin/site',{method:'PUT',body:JSON.stringify(site)});setMessage('Website content saved. Changes will appear on the public site shortly.');}
  catch(e){setError(e instanceof Error?e.message:'Unable to save.');}finally{setBusy(false);}
 }
 return <><PageHeader title="Website content" subtitle="Manage the homepage, About us, How it works, announcements, contact and recruitment copy without editing code." action={<Link className="btn btn-outline" target="_blank" href="/"><ExternalLink size={16}/> Public preview</Link>}/>
 <div className="settings-grid"><div className="panel pad-panel">
  {groups.map(group=><section key={group.title}><h2>{group.title}</h2>{group.fields.map(f=><div className="field" key={f.key}><label>{f.label}</label>{f.multiline?<textarea rows={4} value={String(site[f.key])} onChange={e=>update(f.key,e.target.value)}/>:<input value={String(site[f.key])} onChange={e=>update(f.key,e.target.value)}/>}</div>)}</section>)}
  {(['metrics','steps','aboutValues'] as const).map(key=><section key={key}><h2>{({metrics:'Homepage highlights',steps:'How it works steps',aboutValues:'About KASA values'})[key]}</h2>
   {site[key].map((item,index)=><div className="admin-edit-item" key={index}><div className="form-grid">{key==='metrics'?<>
    <div className="field"><label>Value</label><input value={'value' in item?item.value:''} onChange={e=>editItem(key,index,'value',e.target.value)}/></div>
    <div className="field"><label>Label</label><input value={'label' in item?item.label:''} onChange={e=>editItem(key,index,'label',e.target.value)}/></div>
   </>:<>
    <div className="field"><label>Title</label><input value={'title' in item?item.title:''} onChange={e=>editItem(key,index,'title',e.target.value)}/></div>
    <div className="field"><label>Description</label><input value={'description' in item?item.description:''} onChange={e=>editItem(key,index,'description',e.target.value)}/></div>
   </>}</div><button className="text-link" onClick={()=>removeItem(key,index)}><Trash2 size={15}/> Remove</button></div>)}
   <button className="btn btn-outline" onClick={()=>addItem(key)} disabled={site[key].length>=(key==='metrics'?6:8)}><Plus size={16}/> Add {key==='metrics'?'metric':'item'}</button>
  </section>)}
  {error&&<div className="alert-error">{error}</div>}{message&&<div className="notice">{message}</div>}
  <button className="btn btn-primary" disabled={busy} onClick={()=>void save()}><Save size={16}/>{busy?'Saving…':'Save website changes'}</button>
 </div><aside className="panel pad-panel"><h3>Website publishing</h3><p>The fields on this page are stored in Firebase, validated on the server and displayed publicly. Forms are managed separately under <strong>Form builder</strong>; publishing a form changes the public application links automatically.</p><p>Your official white KASA crest is used throughout the site and staff portal.</p></aside></div></>;
}
