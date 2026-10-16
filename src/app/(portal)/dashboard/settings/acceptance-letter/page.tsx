'use client';

import {useEffect, useState} from 'react';
import {
  Save, Eye, RotateCcw, Plus, Trash2, CheckCircle2,
  Building, Mail, DollarSign, ListChecks, GraduationCap, ShieldCheck
} from 'lucide-react';
import {api, PageHeader} from '@/components/Portal';
import {authHeaders} from '@/lib/firebase-client';
import {
  type AcceptanceLetterConfig,
  defaultAcceptanceLetterConfig
} from '@/lib/acceptance-letter-config';

type Tab = 'branding' | 'letter' | 'fees' | 'requirements' | 'courseReqs';

export default function AcceptanceLetterDesigner() {
  const [config, setConfig] = useState<AcceptanceLetterConfig>(defaultAcceptanceLetterConfig);
  const [activeTab, setActiveTab] = useState<Tab>('branding');
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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

  async function previewPdf() {
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
        subtitle="Modify the official 5-page KASA acceptance pack, fee tables, checklists, institutional branding and letter texts."
        action={
          <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={previewing}
              onClick={() => void previewPdf()}
              style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
            >
              <Eye size={16}/> {previewing ? 'Generating…' : 'Live PDF Preview ↗'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={resetDefaults}
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

      {/* Tabs */}
      <div style={{display: 'flex', gap: 8, borderBottom: '2px solid var(--border)', marginBottom: 20, overflowX: 'auto', paddingBottom: 4}}>
        {[
          {id: 'branding', label: '1. Branding & Header', icon: Building},
          {id: 'letter', label: '2. Letter Content', icon: Mail},
          {id: 'fees', label: '3. Courses & Fees (p.2)', icon: DollarSign},
          {id: 'requirements', label: '4. Checklists (p.3)', icon: ListChecks},
          {id: 'courseReqs', label: '5. Course PPE & Kit (p.4)', icon: GraduationCap}
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

      {/* TAB 1: BRANDING & HEADER */}
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

      {/* Floating Save Bar */}
      <div style={{marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
        <button
          type="button"
          className="btn btn-outline"
          disabled={previewing}
          onClick={() => void previewPdf()}
        >
          <Eye size={16}/> {previewing ? 'Generating…' : 'Live PDF Preview ↗'}
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
