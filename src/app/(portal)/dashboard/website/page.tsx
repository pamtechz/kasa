'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Save,Plus,Trash2,ExternalLink,Megaphone,Eye,MousePointerClick} from 'lucide-react';
import {api,PageHeader} from '@/components/Portal';
import {authHeaders} from '@/lib/firebase-client';
import {defaultSite,type SiteSettings} from '@/lib/site';
import type {AdCampaign} from '@/app/api/admin/ads/route.ts';
type Key=keyof SiteSettings;
type Editable={key:Key;label:string;multiline?:boolean};
const groups:{title:string;fields:Editable[]}[]=[
 {title:'First administrator setup',fields:[{key:'bootstrapTitle',label:'Setup page heading'},{key:'bootstrapDescription',label:'Setup page introduction',multiline:true}]},
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
 const [ads,setAds]=useState<AdCampaign[]>([]);
 const [newAdHeadline,setNewAdHeadline]=useState('');
 const [newAdDesc,setNewAdDesc]=useState('');
 const [newAdImage,setNewAdImage]=useState('');
 const [newAdUrl,setNewAdUrl]=useState('');
 const [newAdPlacement,setNewAdPlacement]=useState<'all'|'homepage_hero'|'programmes'|'sidebar'|'student_portal'>('all');
 const [creatingAd,setCreatingAd]=useState(false);

 const loadAds = async () => {
  try {
   const res = await api<{ads: AdCampaign[]}>('/api/admin/ads');
   setAds(res.ads);
  } catch {}
 };

 useEffect(()=>{
  api<{site:SiteSettings}>('/api/admin/site').then(x=>setSite(x.site)).catch(e=>setError(e.message));
  void loadAds();
 },[]);

 async function createAd(e: React.FormEvent) {
  e.preventDefault();
  if (!newAdHeadline.trim()) return;
  setBusy(true);
  try {
   await api('/api/admin/ads', {
    method: 'POST',
    body: JSON.stringify({
     headline: newAdHeadline,
     description: newAdDesc,
     imageUrl: newAdImage,
     targetUrl: newAdUrl,
     placement: newAdPlacement
    })
   });
   setNewAdHeadline(''); setNewAdDesc(''); setNewAdImage(''); setNewAdUrl('');
   setCreatingAd(false);
   await loadAds();
  } catch (err) {
   setError(err instanceof Error ? err.message : 'Ad creation failed.');
  } finally { setBusy(false); }
 }

 async function uploadAdMedia(file?:File){
  if(!file)return;
  setBusy(true);setError('');setMessage('');
  try{
   const headers=await authHeaders(),body=new FormData();body.append('file',file);
   const response=await fetch('/api/admin/ads/media',{method:'POST',headers,body});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||'Image upload failed.');
   setNewAdImage(result.url);
   setMessage('Banner stored securely in KASA Cloudflare R2. Save the campaign to publish it.');
  }catch(e){setError(e instanceof Error?e.message:'Image upload failed.');}
  finally{setBusy(false);}
 }
 async function toggleAd(ad: AdCampaign) {
  try {
   await api('/api/admin/ads', {
    method: 'PUT',
    body: JSON.stringify({id: ad.id, active: !ad.active})
   });
   await loadAds();
  } catch {}
 }

 async function deleteAd(id: string) {
  try {
   await api(`/api/admin/ads?id=${id}`, {method: 'DELETE'});
   await loadAds();
  } catch {}
 }
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
  {groups.map(group=><section key={group.title}><h2>{group.title}</h2>{group.fields.map(f=><div className="field" key={f.key}><label>{f.label}</label>{f.multiline?<textarea rows={4} value={String(site[f.key]??'')} onChange={e=>update(f.key,e.target.value)}/>:<input value={String(site[f.key])} onChange={e=>update(f.key,e.target.value)}/>}</div>)}</section>)}
  <section><h2>First administrator checklist</h2><p className="muted">These instructions are published on the bootstrap page. Security restrictions and the authorized email cannot be overridden from this editor.</p>
  {(site.bootstrapSteps||defaultSite.bootstrapSteps||[]).map((step,i)=><div className="admin-edit-item" key={i}><div className="field"><label>Step {i+1}</label><textarea rows={2} value={step} onChange={e=>setSite(prev=>({...prev,bootstrapSteps:(prev.bootstrapSteps||defaultSite.bootstrapSteps||[]).map((x,j)=>j===i?e.target.value:x)}))}/></div><button className="text-link" onClick={()=>setSite(prev=>({...prev,bootstrapSteps:(prev.bootstrapSteps||defaultSite.bootstrapSteps||[]).filter((_,j)=>j!==i)}))}><Trash2 size={15}/> Remove</button></div>)}
  <button className="btn btn-outline" disabled={(site.bootstrapSteps||[]).length>=8} onClick={()=>setSite(prev=>({...prev,bootstrapSteps:[...(prev.bootstrapSteps||[]),'Describe the next administrator setup task.']}))}><Plus size={16}/> Add instruction</button></section>
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

  <section style={{marginTop:30,paddingTop:20,borderTop:'1px solid var(--border)'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:16}}>
    <div>
     <h2 style={{margin:0,display:'inline-flex',alignItems:'center',gap:8}}><Megaphone size={20}/> Website & App Advertisements (Ad Manager)</h2>
     <p className="muted" style={{margin:'4px 0 0',fontSize:13}}>Create, publish, and track AdSense-style banners displayed across public website pages and student portal.</p>
    </div>
    <button className="btn btn-outline" type="button" onClick={()=>setCreatingAd(!creatingAd)} style={{display:'inline-flex',alignItems:'center',gap:6}}><Plus size={16}/> New Ad Campaign</button>
   </div>

   {creatingAd&&(
    <form onSubmit={e=>void createAd(e)} style={{background:'#f8faf9',padding:16,borderRadius:12,border:'1px solid var(--border)',marginBottom:20}}>
     <h3 style={{margin:'0 0 12px',fontSize:15}}>Create New Advertisement</h3>
     <div className="form-grid">
      <div className="field full"><label>Ad Headline *</label><input required placeholder="E.g. 2027 January Intake Admissions Now Open!" value={newAdHeadline} onChange={e=>setNewAdHeadline(e.target.value)}/></div>
      <div className="field full"><label>Description / Subtitle</label><input placeholder="E.g. Apply for TEVETA-certified General Agriculture or Short Courses." value={newAdDesc} onChange={e=>setNewAdDesc(e.target.value)}/></div>
      <div className="field"><label>Upload banner (PNG or JPG, maximum 4 MB)</label><input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" disabled={busy} onChange={e=>void uploadAdMedia(e.target.files?.[0])}/>{newAdImage&&<small className="field-hint">Image uploaded to KASA storage, ready to publish.</small>}</div>
      <div className="field"><label>Target Destination URL</label><input placeholder="https://... or /apply/kasa-enrollment-form" value={newAdUrl} onChange={e=>setNewAdUrl(e.target.value)}/></div>
      <div className="field"><label>Placement Location</label><select value={newAdPlacement} onChange={e=>setNewAdPlacement(e.target.value as any)}><option value="all">All Public Pages & Portal</option><option value="homepage_hero">Homepage Hero Banner</option><option value="programmes">Programmes Catalog</option><option value="student_portal">Student Portal Only</option></select></div>
     </div>
     <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12}}>
      <button className="btn btn-outline" type="button" onClick={()=>setCreatingAd(false)}>Cancel</button>
      <button className="btn btn-primary" type="submit" disabled={busy||!newAdHeadline.trim()}><Plus size={16}/> Create Ad</button>
     </div>
    </form>
   )}

   {ads.length===0?<div className="empty-panel" style={{padding:'20px 16px',textAlign:'center'}}><Megaphone size={28} style={{opacity:0.4,marginBottom:6}}/><p style={{margin:0,fontSize:13,fontWeight:600}}>No active advertisement campaigns.</p></div>:<div style={{display:'flex',flexDirection:'column',gap:12}}>
    {ads.map(ad=>(
     <div key={ad.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#ffffff',padding:'12px 16px',borderRadius:10,border:'1px solid var(--border)',flexWrap:'wrap',gap:12}}>
      <div>
       <strong style={{fontSize:14,display:'block'}}>{ad.headline}</strong>
       <span className="muted" style={{fontSize:12}}>{ad.description} · Target: {ad.targetUrl}</span>
       <div style={{display:'flex',gap:12,alignItems:'center',marginTop:4,fontSize:11,color:'var(--muted)'}}>
        <span style={{display:'inline-flex',alignItems:'center',gap:4}}><Eye size={12}/> {ad.impressions||0} Impressions</span>
        <span style={{display:'inline-flex',alignItems:'center',gap:4}}><MousePointerClick size={12}/> {ad.clicks||0} Clicks</span>
        <span>Placement: {ad.placement}</span>
       </div>
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
       <button className="btn btn-sm btn-outline" onClick={()=>void toggleAd(ad)}>{ad.active?'Pause Ad':'Activate Ad'}</button>
       <button className="icon-btn" style={{color:'#ef4444'}} onClick={()=>void deleteAd(ad.id)} title="Delete ad"><Trash2 size={15}/></button>
      </div>
     </div>
    ))}
   </div>}
  </section>
  {error&&<div className="alert-error">{error}</div>}{message&&<div className="notice">{message}</div>}
  <button className="btn btn-primary" disabled={busy} onClick={()=>void save()}><Save size={16}/>{busy?'Saving…':'Save website changes'}</button>
 </div><aside className="panel pad-panel"><h3>Website publishing</h3><p>The fields on this page are stored in Firebase, validated on the server and displayed publicly. Forms are managed separately under <strong>Form builder</strong>; publishing a form changes the public application links automatically.</p><p>Your official white KASA crest is used throughout the site and staff portal.</p></aside></div></>;
}
