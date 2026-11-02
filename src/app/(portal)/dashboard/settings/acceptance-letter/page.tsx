'use client';

import {useEffect, useState} from 'react';
import {
  Save, Eye, RotateCcw, Plus, Trash2, CheckCircle2,
  Building, Mail, DollarSign, ListChecks, GraduationCap, ShieldCheck,
  UploadCloud, Link as LinkIcon, FileText, ExternalLink, Check, FileCheck, Sliders, FileDown
} from 'lucide-react';
import {api, PageHeader} from '@/components/Portal';
import {VisualPdfCoordinateMapper} from '@/components/VisualPdfCoordinateMapper';
import {authHeaders} from '@/lib/firebase-client';
import {ExternalStorageConnection} from '@/components/ExternalStorageConnection';
import {uploadToR2} from '@/lib/r2-upload-client';
import {
  type AcceptanceLetterConfig,
  defaultAcceptanceLetterConfig
} from '@/lib/acceptance-letter-config';

type Tab = 'source' | 'branding' | 'letter' | 'fees' | 'requirements' | 'courseReqs' | 'formAlignment';

export default function AcceptanceLetterDesigner() {
  const [config, setConfig] = useState<AcceptanceLetterConfig>(defaultAcceptanceLetterConfig);
  const [activeTab, setActiveTab] = useState<Tab>('source');
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    api<{config: AcceptanceLetterConfig}>('/api/admin/settings/acceptance-letter')
      .then(r => {
        if (r?.config) setConfig(r.config);
      })
      .catch(e => setError(e.message));
  }, []);

  async function save() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/api/admin/settings/acceptance-letter', {
        method: 'PUT',
        body: JSON.stringify({config})
      });
      setMessage('Acceptance Pack settings and design saved successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save configuration.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePdfUpload(file?: File) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file (.pdf).');
      return;
    }
    setUploadingPdf(true);
    setError('');
    setMessage('');
    try {
      const headers = await authHeaders();
      const fileId=await uploadToR2(file,'acceptance-pdf');
      const res=await fetch('/api/admin/settings/acceptance-letter/attach',{
       method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({fileId})
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || 'Failed to upload Acceptance Pack PDF.');
      setConfig(prev => ({
        ...prev,
        packSource: 'custom',
        customPdf: data.customPdf
      }));
      setMessage('Official Acceptance Pack PDF uploaded and saved successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploadingPdf(false);
    }
  }

  async function handleEnrollmentUpload(file?:File){
    if(!file)return;setUploadingPdf(true);setError('');
    try{
      const id=await uploadToR2(file,'enrollment-pdf');
      const headers=await authHeaders();
      const response=await fetch('/api/admin/settings/enrollment-form/attach',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({fileId:id})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to save the official form.');
      setConfig(prev=>({...prev,enrollmentForm:result.enrollmentForm}));setMessage('Official blank enrollment form saved to your external storage.');
    }catch(e){setError(e instanceof Error?e.message:'Upload failed.');}finally{setUploadingPdf(false);}
  }

  async function previewPdf() {
    if (config.packSource === 'custom' && config.customPdf?.url) {
      if (config.customPdf.type === 'link' && (config.customPdf.url.startsWith('http://') || config.customPdf.url.startsWith('https://'))) {
        window.open(config.customPdf.url, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    setPreviewing(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/settings/acceptance-letter/preview', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({config})
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Error(body.error || 'Unable to generate preview PDF.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview generation failed.');
    } finally {
      setPreviewing(false);
    }
  }

  async function previewEnrollmentFormAlignment() {
    setPreviewing(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/settings/acceptance-letter/preview-enrollment-form', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({config})
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Error(body.error || 'Unable to generate preview Enrollment Form PDF.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview generation failed.');
    } finally {
      setPreviewing(false);
    }
  }

  function resetDefaults() {
    if (confirm('Reset all Acceptance Pack contents and design to official KASA defaults?')) {
      setConfig(structuredClone(defaultAcceptanceLetterConfig));
      setMessage('Reset to default KASA proposal. Click Save to apply.');
    }
  }

  return (
    <>
      <PageHeader
        title="Acceptance Pack & Letter Designer"
        subtitle="Modify the official KASA acceptance pack: configure the automated 5-page PDF template or upload a custom official PDF via link or file upload."
        action={
          <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={previewing}
              onClick={() => void previewPdf()}
              style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
            >
              <Eye size={16}/> {previewing ? 'Generating…' : 'Preview Acceptance Pack'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              disabled={previewing}
              onClick={() => void previewEnrollmentFormAlignment()}
              style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
            >
              <FileCheck size={16}/> {previewing ? 'Generating…' : 'Preview Enrollment Form'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setConfirmingReset(true)}
              style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
              title="Reset to official KASA template"
            >
              <RotateCcw size={15}/> Reset Defaults
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void save()}
              style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
            >
              <Save size={16}/> {busy ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        }
      />

      {message && <div className="notice" style={{marginBottom: 16}}><CheckCircle2 size={16}/> {message}</div>}
      {error && <div className="alert-error" style={{marginBottom: 16}}>{error}</div>}

      {/* Mode Status Pill */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        background: config.packSource === 'custom' ? '#f0f7ff' : '#edf7f1',
        border: `1px solid ${config.packSource === 'custom' ? '#b6d7fe' : '#b7e4c7'}`,
        borderRadius: 10,
        padding: '12px 18px',
        marginBottom: 20
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
          {config.packSource === 'custom' ? (
            <FileText size={20} style={{color: '#0066cc'}}/>
          ) : (
            <FileCheck size={20} style={{color: '#1b7a43'}}/>
          )}
          <div>
            <span style={{fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: config.packSource === 'custom' ? '#0055aa' : '#146334'}}>Active Acceptance Pack Source</span>
            <div style={{fontSize: 14, fontWeight: 600, color: '#1c2826'}}>
              {config.packSource === 'custom'
                ? `Custom PDF Document (${config.customPdf.type === 'link' ? 'External Web Link' : 'Uploaded File: ' + (config.customPdf.fileName || 'PDF Document')})`
                : 'Automated 5-Page KASA Dynamic PDF Generator'}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="text-link"
          onClick={() => setActiveTab('source')}
          style={{fontWeight: 700}}
        >
          Change source format →
        </button>
      </div>

      {/* Tabs */}
      <div style={{display: 'flex', gap: 8, borderBottom: '2px solid var(--border)', marginBottom: 20, overflowX: 'auto', paddingBottom: 4}}>
        {[
          {id: 'source', label: '1. Document Source & Upload', icon: UploadCloud},
          {id: 'branding', label: '2. Branding & Header', icon: Building},
          {id: 'letter', label: '3. Letter Content', icon: Mail},
          {id: 'fees', label: '4. Courses & Fees (p.2)', icon: DollarSign},
          {id: 'requirements', label: '5. Checklists (p.3)', icon: ListChecks},
          {id: 'courseReqs', label: '6. Course PPE & Kit (p.4)', icon: GraduationCap},
          {id: 'formAlignment', label: '7. Enrollment Form Alignment (X/Y Offsets)', icon: Sliders}
        ].map(tab => {
          const I = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as Tab)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                border: 'none',
                background: active ? 'var(--green-light, #e8f5e9)' : 'transparent',
                color: active ? '#155724' : 'var(--text-muted)',
                fontWeight: active ? 700 : 500,
                borderBottom: active ? '3px solid #155724' : '3px solid transparent',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <I size={16}/> {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DOCUMENT SOURCE & UPLOAD OPTIONS */}
      {activeTab === 'source' && (
        <section className="panel pad-panel">
          <h2>Acceptance Pack Delivery Options</h2>
          <p className="muted">
            Choose whether to generate the official Acceptance Pack dynamically using KASA&apos;s 5-page template, or provide a pre-designed official PDF document either via link or direct file upload.
          </p>

          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, margin: '24px 0'}}>
            {/* Mode 1: Automated Template */}
            <div
              onClick={() => setConfig({...config, packSource: 'generated'})}
              style={{
                border: config.packSource === 'generated' ? '2px solid #103f2c' : '1px solid var(--border)',
                background: config.packSource === 'generated' ? '#f4faf6' : '#fff',
                borderRadius: 14,
                padding: 22,
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s'
              }}
            >
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: '#e7f5eb',
                  color: '#1b7a43',
                  display: 'grid',
                  placeItems: 'center'
                }}>
                  <FileCheck size={22}/>
                </div>
                <input
                  type="radio"
                  name="packSource"
                  checked={config.packSource === 'generated'}
                  onChange={() => setConfig({...config, packSource: 'generated'})}
                  style={{width: 18, height: 18, accentColor: '#103f2c'}}
                />
              </div>
              <h3 style={{margin: '0 0 6px', fontSize: 16}}>Automated 5-Page Template</h3>
              <p className="muted" style={{fontSize: 13, lineHeight: 1.6, margin: 0}}>
                Generates a live, personalized 5-page Acceptance Pack featuring the student&apos;s name, course fee schedule, boarding options, PPE checklist, and tear-off acceptance form.
              </p>
              <div style={{marginTop: 14, fontSize: 12, fontWeight: 700, color: '#103f2c'}}>
                Customized via Tabs 2 to 6 →
              </div>
            </div>

            {/* Mode 2: Custom PDF Document */}
            <div
              onClick={() => setConfig({...config, packSource: 'custom'})}
              style={{
                border: config.packSource === 'custom' ? '2px solid #103f2c' : '1px solid var(--border)',
                background: config.packSource === 'custom' ? '#f4faf6' : '#fff',
                borderRadius: 14,
                padding: 22,
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s'
              }}
            >
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: '#e0f2fe',
                  color: '#0284c7',
                  display: 'grid',
                  placeItems: 'center'
                }}>
                  <UploadCloud size={22}/>
                </div>
                <input
                  type="radio"
                  name="packSource"
                  checked={config.packSource === 'custom'}
                  onChange={() => setConfig({...config, packSource: 'custom'})}
                  style={{width: 18, height: 18, accentColor: '#103f2c'}}
                />
              </div>
              <h3 style={{margin: '0 0 6px', fontSize: 16}}>Upload Official Acceptance Pack PDF</h3><ExternalStorageConnection/>
              <p className="muted" style={{fontSize: 13, lineHeight: 1.6, margin: 0}}>
                Provide an official pre-designed PDF document. When accepted, applicants download this exact official institutional PDF document.
              </p>
              <div style={{marginTop: 14, fontSize: 12, fontWeight: 700, color: '#0284c7'}}>
                Supports direct file upload OR external link →
              </div>
            </div>
          </div>

          {/* If Custom PDF mode is active */}
          {config.packSource === 'custom' && (
            <div style={{
              background: '#f8faf9',
              border: '1px solid #dbe5e0',
              borderRadius: 12,
              padding: 24,
              marginTop: 18
            }}>
              <h3 style={{margin: '0 0 6px', fontSize: 15}}>Provide Official Acceptance Pack PDF</h3>
              <p className="muted" style={{fontSize: 13, margin: '0 0 18px'}}>
                Choose whether to upload a PDF file from your device, or provide a direct web link to an externally hosted PDF.
              </p>

              {/* Toggle: Upload vs Link */}
              <div style={{display: 'inline-flex', background: '#eef3f0', padding: 4, borderRadius: 8, marginBottom: 20}}>
                <button
                  type="button"
                  onClick={() => setConfig({
                    ...config,
                    customPdf: {...config.customPdf, type: 'upload'}
                  })}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 6,
                    border: 'none',
                    background: config.customPdf.type === 'upload' ? '#fff' : 'transparent',
                    color: config.customPdf.type === 'upload' ? '#103f2c' : '#556660',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    boxShadow: config.customPdf.type === 'upload' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <UploadCloud size={15}/> Choose PDF file
                </button>
              </div>

              {/* OPTION 1: FILE UPLOAD */}
              {config.customPdf.type === 'upload' && (
                <div>
                  <div style={{
                    border: '2px dashed #b7cdc2',
                    borderRadius: 12,
                    padding: '28px 20px',
                    textAlign: 'center',
                    background: '#fff',
                    position: 'relative'
                  }}>
                    <UploadCloud size={36} style={{color: '#2a7550', margin: '0 auto 10px'}}/>
                    <h4 style={{margin: '0 0 6px', fontSize: 15}}>
                      {uploadingPdf ? 'Uploading Acceptance Pack PDF…' : 'Choose or drop an official Acceptance Pack PDF'}
                    </h4>
                    <p className="muted" style={{fontSize: 12, margin: '0 0 16px'}}>
                      Supported format: PDF only. Maximum file size: 25 MB.
                    </p>
                    <label className="btn btn-outline" style={{cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8}}>
                      <UploadCloud size={16}/> {uploadingPdf ? 'Uploading…' : 'Select PDF from computer'}
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        disabled={uploadingPdf}
                        onChange={e => void handlePdfUpload(e.target.files?.[0])}
                        style={{display: 'none'}}
                      />
                    </label>
                  </div>

                  {config.customPdf.url && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                      marginTop: 16,
                      padding: '14px 18px',
                      background: '#fff',
                      borderRadius: 10,
                      border: '1px solid #d0ded6'
                    }}>
                      <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                        <FileText size={20} style={{color: '#103f2c'}}/>
                        <div>
                          <strong>{config.customPdf.fileName || 'Official Acceptance Pack'}</strong>
                          <div style={{fontSize: 11, color: 'var(--muted)', marginTop: 2}}>
                            {config.customPdf.fileSize ? `${(config.customPdf.fileSize / (1024 * 1024)).toFixed(2)} MB · ` : ''}
                            {config.customPdf.uploadedAt ? `Uploaded on ${new Date(config.customPdf.uploadedAt).toLocaleString()}` : 'Uploaded document ready'}
                          </div>
                        </div>
                      </div>
                      <div style={{display: 'flex', gap: 8}}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => void previewPdf()}
                          style={{fontSize: 12, padding: '7px 12px'}}
                        >
                          <Eye size={14}/> View uploaded PDF
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* OPTION 2: EXTERNAL LINK / URL */}
              {config.customPdf.type === 'link' && (
                <div>
                  <div className="field">
                    <label>External PDF Link / URL</label>
                    <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
                      <input
                        type="url" readOnly aria-label="Previously configured PDF URL"
                        placeholder="https://example.com/documents/KASA-Official-Acceptance-Pack.pdf"
                        value={config.customPdf.url}
                        onChange={e => setConfig({
                          ...config,
                          customPdf: {
                            ...config.customPdf,
                            url: e.target.value.trim(),
                            fileName: config.customPdf.fileName || 'Official Acceptance Pack'
                          }
                        })}
                        style={{flex: 1, minWidth: 260}}
                      />
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={!config.customPdf.url}
                        onClick={() => {
                          if (config.customPdf.url) {
                            window.open(config.customPdf.url, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
                      >
                        <ExternalLink size={15}/> Test / Preview Link
                      </button>
                    </div>
                    <p className="muted" style={{fontSize: 12, marginTop: 6}}>
                      Direct HTTPS URL to an official PDF document. For Google Drive files, ensure sharing is set to &ldquo;Anyone with the link&rdquo; and use a direct download link.
                    </p>
                  </div>

                  <div className="field">
                    <label>Document Display Name (optional)</label>
                    <input
                      type="text"
                      placeholder="E.g. KASA Official Acceptance Pack 2027"
                      value={config.customPdf.fileName}
                      onChange={e => setConfig({
                        ...config,
                        customPdf: {
                          ...config.customPdf,
                          fileName: e.target.value
                        }
                      })}
                    />
                  </div>
                </div>
              )}

              <div style={{marginTop: 20}}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || uploadingPdf}
                  onClick={() => void save()}
                  style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
                >
                  <Save size={16}/> Save Acceptance Pack Settings
                </button>
              </div>
            </div>
          )}

          {/* Section: Official Blank Enrollment Form Download Link */}
          <div style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: '1px solid var(--border)'
          }}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
              <FileText size={22} style={{color:'var(--green)'}}/>
              <h3 style={{margin:0,fontSize:17}}>Official blank enrollment form PDF</h3>
            </div>
            <p className="muted" style={{fontSize:13,lineHeight:1.6,marginBottom:18}}>
              Choose a PDF from your device. It goes directly to your authorized external storage and becomes the official blank form. Leave it empty to use the built-in template.
            </p>

            <div style={{display:'grid',gap:16,background:'#f8faf9',border:'1px solid #dbe5e0',borderRadius:12,padding:22}}>
              <ExternalStorageConnection/>
              <div className="field"><label htmlFor="blank-enrollment-pdf">Choose official blank enrollment PDF</label><input id="blank-enrollment-pdf" type="file" accept="application/pdf" disabled={uploadingPdf} onChange={e=>void handleEnrollmentUpload(e.target.files?.[0])}/>
              {config.enrollmentForm?.url&&<p className="field-hint">Current file: {config.enrollmentForm.fileName||'Official form'}</p>}
              <a href="/api/public/download-enrollment-form" target="_blank" rel="noopener noreferrer" className="text-link">Test public download</a></div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: BRANDING & HEADER */}
      {activeTab === 'branding' && (
        <section className="panel pad-panel">
          <h2>Institutional Branding & Contacts</h2>
          <p className="muted">These details appear on the official green-and-gold header and footer banner across all 5 pages.</p>
          <div className="form-grid">
            <div className="field full">
              <label>Institution Name</label>
              <input
                value={config.institution.name}
                onChange={e => setConfig({
                  ...config,
                  institution: {...config.institution, name: e.target.value}
                })}
              />
            </div>
            <div className="field full">
              <label>Motto / Subtitle</label>
              <input
                value={config.institution.motto}
                onChange={e => setConfig({
                  ...config,
                  institution: {...config.institution, motto: e.target.value}
                })}
              />
            </div>
            <div className="field">
              <label>Lusaka Office Address</label>
              <input
                value={config.institution.lusakaAddress}
                onChange={e => setConfig({
                  ...config,
                  institution: {...config.institution, lusakaAddress: e.target.value}
                })}
              />
            </div>
            <div className="field">
              <label>Campus / Farm Block Address</label>
              <input
                value={config.institution.campusAddress}
                onChange={e => setConfig({
                  ...config,
                  institution: {...config.institution, campusAddress: e.target.value}
                })}
              />
            </div>
            <div className="field">
              <label>Admissions Phone</label>
              <input
                value={config.institution.phone}
                onChange={e => setConfig({
                  ...config,
                  institution: {...config.institution, phone: e.target.value}
                })}
              />
            </div>
            <div className="field">
              <label>Admissions Email</label>
              <input
                value={config.institution.email}
                onChange={e => setConfig({
                  ...config,
                  institution: {...config.institution, email: e.target.value}
                })}
              />
            </div>
            <div className="field">
              <label>Primary Brand Color (Banner)</label>
              <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                <input
                  type="color"
                  value={config.institution.primaryColorHex}
                  onChange={e => setConfig({
                    ...config,
                    institution: {...config.institution, primaryColorHex: e.target.value}
                  })}
                  style={{width: 48, height: 38, padding: 2, cursor: 'pointer'}}
                />
                <input
                  value={config.institution.primaryColorHex}
                  onChange={e => setConfig({
                    ...config,
                    institution: {...config.institution, primaryColorHex: e.target.value}
                  })}
                  style={{width: 120}}
                />
              </div>
            </div>
            <div className="field">
              <label>Accent Color (Gold Bar)</label>
              <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                <input
                  type="color"
                  value={config.institution.goldColorHex}
                  onChange={e => setConfig({
                    ...config,
                    institution: {...config.institution, goldColorHex: e.target.value}
                  })}
                  style={{width: 48, height: 38, padding: 2, cursor: 'pointer'}}
                />
                <input
                  value={config.institution.goldColorHex}
                  onChange={e => setConfig({
                    ...config,
                    institution: {...config.institution, goldColorHex: e.target.value}
                  })}
                  style={{width: 120}}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: LETTER CONTENT */}
      {activeTab === 'letter' && (
        <section className="panel pad-panel">
          <h2>Letter of Acceptance (Page 1)</h2>
          <p className="muted">Configure the salutation, acceptance text, and reporting instructions shown on page 1 of the offer.</p>
          <div className="form-grid">
            <div className="field">
              <label>Letter Title</label>
              <input
                value={config.letter.title}
                onChange={e => setConfig({
                  ...config,
                  letter: {...config.letter, title: e.target.value}
                })}
              />
            </div>
            <div className="field">
              <label>Salutation</label>
              <input
                value={config.letter.salutation}
                onChange={e => setConfig({
                  ...config,
                  letter: {...config.letter, salutation: e.target.value}
                })}
              />
            </div>
            <div className="field full">
              <label>Opening Acceptance Text</label>
              <textarea
                rows={2}
                value={config.letter.introText}
                onChange={e => setConfig({
                  ...config,
                  letter: {...config.letter, introText: e.target.value}
                })}
              />
            </div>
            <div className="field full">
              <label>Confirmation & Return Instructions (Paragraph 1)</label>
              <textarea
                rows={2}
                value={config.letter.instructionsText1}
                onChange={e => setConfig({
                  ...config,
                  letter: {...config.letter, instructionsText1: e.target.value}
                })}
              />
            </div>
            <div className="field full">
              <label>Fee Schedule & CDF Reference (Paragraph 2)</label>
              <textarea
                rows={2}
                value={config.letter.instructionsText2}
                onChange={e => setConfig({
                  ...config,
                  letter: {...config.letter, instructionsText2: e.target.value}
                })}
              />
            </div>
            <div className="field full">
              <label>Campus Reporting Directions (Paragraph 3)</label>
              <textarea
                rows={2}
                value={config.letter.reportingDirections}
                onChange={e => setConfig({
                  ...config,
                  letter: {...config.letter, reportingDirections: e.target.value}
                })}
              />
            </div>
            <div className="field">
              <label>Welcome Sentence</label>
              <input
                value={config.letter.welcomeText}
                onChange={e => setConfig({
                  ...config,
                  letter: {...config.letter, welcomeText: e.target.value}
                })}
              />
            </div>
            <div className="field">
              <label>Signatory Name</label>
              <input
                value={config.letter.signatory}
                onChange={e => setConfig({
                  ...config,
                  letter: {...config.letter, signatory: e.target.value}
                })}
              />
            </div>
            <div className="field">
              <label>Signatory Title / Designation</label>
              <input
                value={config.letter.signatoryTitle}
                onChange={e => setConfig({
                  ...config,
                  letter: {...config.letter, signatoryTitle: e.target.value}
                })}
              />
            </div>
            <div className="field">
              <label>Official Stamp Watermark Text</label>
              <input
                value={config.letter.officialStampText}
                onChange={e => setConfig({
                  ...config,
                  letter: {...config.letter, officialStampText: e.target.value}
                })}
              />
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: FEES TABLE (PAGE 2) */}
      {activeTab === 'fees' && (
        <section className="panel pad-panel">
          <h2>Courses and Fees Schedule (Page 2)</h2>
          <p className="muted">Manage the official tariff tables and boarding charges rendered on page 2 of the acceptance pack.</p>

          <h3 style={{marginTop: 20}}>Main Programmes</h3>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Programme or route</th>
                  <th>Duration</th>
                  <th>Fee (ZMW)</th>
                  <th style={{width: 60}}>Action</th>
                </tr>
              </thead>
              <tbody>
                {config.fees.mainProgrammes.map((p, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        value={p.name}
                        onChange={e => {
                          const next = [...config.fees.mainProgrammes];
                          next[idx].name = e.target.value;
                          setConfig({...config, fees: {...config.fees, mainProgrammes: next}});
                        }}
                      />
                    </td>
                    <td>
                      <input
                        value={p.duration}
                        onChange={e => {
                          const next = [...config.fees.mainProgrammes];
                          next[idx].duration = e.target.value;
                          setConfig({...config, fees: {...config.fees, mainProgrammes: next}});
                        }}
                      />
                    </td>
                    <td>
                      <input
                        value={p.fee}
                        onChange={e => {
                          const next = [...config.fees.mainProgrammes];
                          next[idx].fee = e.target.value;
                          setConfig({...config, fees: {...config.fees, mainProgrammes: next}});
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          const next = config.fees.mainProgrammes.filter((_, i) => i !== idx);
                          setConfig({...config, fees: {...config.fees, mainProgrammes: next}});
                        }}
                      >
                        <Trash2 size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            style={{marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6}}
            onClick={() => {
              setConfig({
                ...config,
                fees: {
                  ...config.fees,
                  mainProgrammes: [...config.fees.mainProgrammes, {name: 'New Programme', duration: '6 months', fee: '5,000'}]
                }
              });
            }}
          >
            <Plus size={15}/> Add Main Programme
          </button>

          <h3 style={{marginTop: 30}}>Independent Short Courses</h3>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Short course title</th>
                  <th>Duration</th>
                  <th>Fee (ZMW)</th>
                  <th style={{width: 60}}>Action</th>
                </tr>
              </thead>
              <tbody>
                {config.fees.shortCourses.map((c, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        value={c.name}
                        onChange={e => {
                          const next = [...config.fees.shortCourses];
                          next[idx].name = e.target.value;
                          setConfig({...config, fees: {...config.fees, shortCourses: next}});
                        }}
                      />
                    </td>
                    <td>
                      <input
                        value={c.duration}
                        onChange={e => {
                          const next = [...config.fees.shortCourses];
                          next[idx].duration = e.target.value;
                          setConfig({...config, fees: {...config.fees, shortCourses: next}});
                        }}
                      />
                    </td>
                    <td>
                      <input
                        value={c.fee}
                        onChange={e => {
                          const next = [...config.fees.shortCourses];
                          next[idx].fee = e.target.value;
                          setConfig({...config, fees: {...config.fees, shortCourses: next}});
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          const next = config.fees.shortCourses.filter((_, i) => i !== idx);
                          setConfig({...config, fees: {...config.fees, shortCourses: next}});
                        }}
                      >
                        <Trash2 size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            style={{marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6}}
            onClick={() => {
              setConfig({
                ...config,
                fees: {
                  ...config.fees,
                  shortCourses: [...config.fees.shortCourses, {name: 'New Short Course', duration: '8 weeks', fee: '3,000'}]
                }
              });
            }}
          >
            <Plus size={15}/> Add Short Course
          </button>

          <h3 style={{marginTop: 30}}>Boarding Meals & Payment Arrangements</h3>
          <div className="form-grid">
            <div className="field">
              <label>Hostel Bedspace Tariff</label>
              <input
                value={config.fees.hostelBedspaceMonthly}
                onChange={e => setConfig({
                  ...config,
                  fees: {...config.fees, hostelBedspaceMonthly: e.target.value}
                })}
              />
            </div>
            <div className="field">
              <label>Meals Tariff</label>
              <input
                value={config.fees.mealsMonthly}
                onChange={e => setConfig({
                  ...config,
                  fees: {...config.fees, mealsMonthly: e.target.value}
                })}
              />
            </div>
            <div className="field full">
              <label>Academic-Fee Installments Note</label>
              <textarea
                rows={2}
                value={config.fees.instalmentNote}
                onChange={e => setConfig({
                  ...config,
                  fees: {...config.fees, instalmentNote: e.target.value}
                })}
              />
            </div>
          </div>
        </section>
      )}

      {/* TAB 4: CHECKLISTS (PAGE 3) */}
      {activeTab === 'requirements' && (
        <section className="panel pad-panel">
          <h2>Personal and School Requirements (Page 3)</h2>
          <p className="muted">Items students must bring when reporting. Tickboxes are rendered next to each item in the PDF.</p>

          {(['checklistA', 'checklistB', 'checklistC', 'checklistD'] as const).map(key => {
            const titleMap = {
              checklistA: 'A  Admission and school records',
              checklistB: 'B  School and classroom materials',
              checklistC: 'C  Personal requirements',
              checklistD: 'D  Boarding requirements if applicable'
            };
            const list = config.requirements[key];
            return (
              <div key={key} style={{marginBottom: 24, borderTop: '1px solid var(--border)', paddingTop: 16}}>
                <h3>{titleMap[key]}</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10}}>
                  {list.map((item, idx) => (
                    <div key={idx} style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                      <input
                        value={item}
                        onChange={e => {
                          const next = [...list];
                          next[idx] = e.target.value;
                          setConfig({...config, requirements: {...config.requirements, [key]: next}});
                        }}
                        style={{flex: 1}}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          const next = list.filter((_, i) => i !== idx);
                          setConfig({...config, requirements: {...config.requirements, [key]: next}});
                        }}
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6}}
                  onClick={() => {
                    setConfig({
                      ...config,
                      requirements: {
                        ...config.requirements,
                        [key]: [...list, 'New required item']
                      }
                    });
                  }}
                >
                  <Plus size={14}/> Add Requirement
                </button>
              </div>
            );
          })}
        </section>
      )}

      {/* TAB 5: COURSE PPE & KIT (PAGE 4) */}
      {activeTab === 'courseReqs' && (
        <section className="panel pad-panel">
          <h2>Course Requirements & Participation Rules (Page 4)</h2>
          <p className="muted">Specific overalls, boots, kit, and PPE equipment for agricultural and athletic programmes.</p>

          <div className="field full" style={{marginTop: 16}}>
            <label>A  Agri-Sport Foundation & Applied PPE Instructions</label>
            <textarea
              rows={3}
              value={config.courseRequirements.agriSportText}
              onChange={e => setConfig({
                ...config,
                courseRequirements: {...config.courseRequirements, agriSportText: e.target.value}
              })}
            />
          </div>

          <h3 style={{marginTop: 20}}>B  General Agriculture TEVETA Pathway Kit</h3>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{width: 140}}>Level</th>
                  <th>Student supplied practical items</th>
                </tr>
              </thead>
              <tbody>
                {config.courseRequirements.tevetaLevels.map((lvl, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        value={lvl.level}
                        onChange={e => {
                          const next = [...config.courseRequirements.tevetaLevels];
                          next[idx].level = e.target.value;
                          setConfig({...config, courseRequirements: {...config.courseRequirements, tevetaLevels: next}});
                        }}
                      />
                    </td>
                    <td>
                      <input
                        value={lvl.items}
                        onChange={e => {
                          const next = [...config.courseRequirements.tevetaLevels];
                          next[idx].items = e.target.value;
                          setConfig({...config, courseRequirements: {...config.courseRequirements, tevetaLevels: next}});
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{marginTop: 20}}>C  Independent Short Courses Kit & Supervised Requirements</h3>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{width: 180}}>Course</th>
                  <th>Student supplied items & rules</th>
                </tr>
              </thead>
              <tbody>
                {config.courseRequirements.shortCoursesList.map((sc, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        value={sc.course}
                        onChange={e => {
                          const next = [...config.courseRequirements.shortCoursesList];
                          next[idx].course = e.target.value;
                          setConfig({...config, courseRequirements: {...config.courseRequirements, shortCoursesList: next}});
                        }}
                      />
                    </td>
                    <td>
                      <input
                        value={sc.requirements}
                        onChange={e => {
                          const next = [...config.courseRequirements.shortCoursesList];
                          next[idx].requirements = e.target.value;
                          setConfig({...config, courseRequirements: {...config.courseRequirements, shortCoursesList: next}});
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="field full" style={{marginTop: 20}}>
            <label>Shared Specialist Tools & Task-Specific PPE Notice</label>
            <textarea
              rows={2}
              value={config.courseRequirements.sharedToolsNote}
              onChange={e => setConfig({
                ...config,
                courseRequirements: {...config.courseRequirements, sharedToolsNote: e.target.value}
              })}
            />
          </div>
        </section>
      )}

      {/* TAB 7: VISUAL DRAG-AND-DROP ENROLLMENT FORM FIELD ALIGNMENT */}
      {activeTab === 'formAlignment' && (
        <section className="panel pad-panel">
          <div style={{marginBottom: 16}}>
            <h2>Visual Drag & Drop Enrollment Form Field Mapper</h2>
            <p className="muted" style={{fontSize: 13, margin: '4px 0 0'}}>
              Drag and drop field overlays directly on the A4 document canvas to align text 100% perfectly with your pre-printed form boxes.
            </p>
          </div>

          <VisualPdfCoordinateMapper
            config={config}
            onChange={updated => setConfig(updated)}
            onPreviewPdf={() => void previewEnrollmentFormAlignment()}
            previewing={previewing}
          />
        </section>
      )}

      {/* Floating Save Bar */}
      <div style={{marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
        <button
          type="button"
          className="btn btn-outline"
          disabled={previewing}
          onClick={() => void previewPdf()}
        >
          <Eye size={16}/> {previewing ? 'Generating…' : 'Live PDF Preview'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void save()}
        >
          <Save size={16}/> {busy ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </>
  );
}
