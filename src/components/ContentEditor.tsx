'use client';
import {useEffect, useState, useCallback} from 'react';
import {
  Save, Plus, Trash2, Search, ExternalLink, X, ArrowLeft,
  CheckCircle2, AlertCircle, BookOpen, Clock, FileText, DollarSign,
  GraduationCap, Calendar, Tag, ShieldCheck, Eye, Layers
} from 'lucide-react';
import {api, cachedApi, PageHeader} from '@/components/Portal';
import {ConfirmModal} from '@/components/ConfirmModal';
import type {Programme, Announcement} from '@/lib/content';

type Type = 'programmes' | 'announcements';

const emptyProgramme: Programme = {
  id: '',
  title: '',
  description: '',
  published: false,
  category: 'short-course',
  duration: '',
  durationHours: null,
  requirements: '',
  certification: '',
  modules: [],
  fee: {
    tuition: null,
    practical: null,
    administration: null,
    foodOptional: null,
    accommodationOptional: null,
    packageTotal: null,
    currency: 'ZMW',
    note: ''
  }
};

const emptyAnnouncement: Announcement = {
  id: '',
  title: '',
  description: '',
  published: false,
  body: '',
  category: 'general',
  pinned: false,
  publishedAt: null,
  expiresAt: null
};

function dateInput(s: string | null) {
  if (!s) return '';
  const d = new Date(s);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function ContentEditor({kind}: {kind: Type}) {
  const isProgramme = kind === 'programmes';
  const [items, setItems] = useState<(Programme | Announcement)[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Programme | Announcement | null>(null);
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modalTab, setModalTab] = useState<string>('basic');

  // Fast SWR loading
  const load = useCallback(async (force = false) => {
    try {
      const url = '/api/admin/content?kind=' + kind;
      if (force) {
        const r = await api<{items: (Programme | Announcement)[]}>(url);
        setItems(r.items);
      } else {
        const r = await cachedApi<{items: (Programme | Announcement)[]}>(
          url,
          (fresh) => setItems(fresh.items)
        );
        setItems(r.items);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load records.');
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  // Handle ESC key to close modal page
  useEffect(() => {
    if (!current) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCurrent(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [current]);

  function editField(field: string, value: unknown) {
    setCurrent(p => (p ? {...p, [field]: value} : p));
  }

  function feeField(field: string, value: string) {
    setCurrent(p => {
      if (!p || !('fee' in p)) return p;
      const progItem = p as Programme;
      return {
        ...progItem,
        fee: {
          ...progItem.fee,
          [field]: field === 'note' ? value : value === '' ? null : Number(value)
        }
      };
    });
  }

  function addCustomField() {
    setCurrent(p => {
      if (!p) return p;
      const existing = (p.customFields as Record<string, string>) || {};
      const newKey = `Custom Field ${Object.keys(existing).length + 1}`;
      return {
        ...p,
        customFields: {
          ...existing,
          [newKey]: ''
        }
      };
    });
  }

  function updateCustomFieldKey(oldKey: string, newKey: string) {
    setCurrent(p => {
      if (!p) return p;
      const existing = (p.customFields as Record<string, string>) || {};
      const updated: Record<string, string> = {};
      for (const [k, v] of Object.entries(existing)) {
        if (k === oldKey) {
          if (newKey.trim()) updated[newKey] = v;
        } else {
          updated[k] = v;
        }
      }
      return { ...p, customFields: updated };
    });
  }

  function updateCustomFieldValue(key: string, val: string) {
    setCurrent(p => {
      if (!p) return p;
      const existing = (p.customFields as Record<string, string>) || {};
      return {
        ...p,
        customFields: {
          ...existing,
          [key]: val
        }
      };
    });
  }

  function removeCustomField(key: string) {
    setCurrent(p => {
      if (!p) return p;
      const existing = (p.customFields as Record<string, string>) || {};
      const updated: Record<string, string> = {};
      for (const [k, v] of Object.entries(existing)) {
        if (k !== key) updated[k] = v;
      }
      return { ...p, customFields: updated };
    });
  }

  const [deletingItem, setDeletingItem] = useState<Programme | Announcement | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<'selected' | 'all' | null>(null);

  function openCreate() {
    setCurrent(isProgramme ? structuredClone(emptyProgramme) : structuredClone(emptyAnnouncement));
    setEditing(false);
    setError('');
    setMessage('');
    setModalTab('basic');
  }

  function openEdit(item: Programme | Announcement) {
    setCurrent(structuredClone(item));
    setEditing(true);
    setError('');
    setMessage('');
    setModalTab('basic');
  }

  async function save() {
    if (!current) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/api/admin/content', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({kind, item: current})
      });
      setCurrent(null);
      await load(true);
      setMessage(isProgramme ? 'Programme record saved successfully.' : 'Announcement saved successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!deletingItem) return;
    try {
      await api('/api/admin/content', {
        method: 'DELETE',
        body: JSON.stringify({kind, id: deletingItem.id})
      });
      if (current?.id === deletingItem.id) setCurrent(null);
      setDeletingItem(null);
      await load(true);
      setMessage('Record deleted.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  async function confirmBulkDeleteContent() {
    if (!bulkDeleteTarget) return;
    try {
      const idsToDelete = bulkDeleteTarget === 'selected' ? Array.from(selectedItemIds) : filteredItems.map(x => x.id);
      for (const id of idsToDelete) {
        await api('/api/admin/content', {
          method: 'DELETE',
          body: JSON.stringify({kind, id})
        });
      }
      setSelectedItemIds(new Set());
      setBulkDeleteTarget(null);
      await load(true);
      setMessage(`Successfully deleted ${idsToDelete.length} record(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk delete failed.');
    }
  }

  const filteredItems = items.filter(x =>
    (x.title + ' ' + x.description + ' ' + x.id).toLowerCase().includes(filter.toLowerCase())
  );

  const allItemsSelected = filteredItems.length > 0 && filteredItems.every(x => selectedItemIds.has(x.id));

  function toggleSelectAllItems() {
    if (allItemsSelected) setSelectedItemIds(new Set());
    else setSelectedItemIds(new Set(filteredItems.map(x => x.id)));
  }

  function toggleSelectItem(id: string) {
    const next = new Set(selectedItemIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedItemIds(next);
  }

  return (
    <>
      <PageHeader
        title={isProgramme ? 'Programmes and fees' : 'Announcements'}
        subtitle={
          isProgramme
            ? 'Maintain courses, entry criteria, module outlines and proposed costs in Firestore.'
            : 'Create, publish, pin, schedule and withdraw official institutional announcements.'
        }
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add new
          </button>
        }
      />

      {error && !current && <div className="alert-error">{error}</div>}
      {message && !current && <div className="notice">{message}</div>}

      <div className="panel">
        <div className="table-controls" style={{flexWrap:'wrap',gap:12}}>
          <label className="search-box">
            <Search size={16} />
            <input
              placeholder={`Search ${isProgramme ? 'programmes' : 'announcements'}…`}
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </label>
          <div style={{display:'flex',gap:8,alignItems:'center',marginLeft:'auto'}}>
            <span className="count-chip">{filteredItems.length} records</span>
            {selectedItemIds.size > 0 && (
              <button className="btn btn-outline" onClick={() => setBulkDeleteTarget('selected')} style={{fontSize:12,padding:'6px 12px',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'inline-flex',alignItems:'center',gap:6}}>
                <Trash2 size={14} /> Delete Selected ({selectedItemIds.size})
              </button>
            )}
            {filteredItems.length > 0 && (
              <button className="btn btn-outline" onClick={() => setBulkDeleteTarget('all')} style={{fontSize:12,padding:'6px 12px',color:'#ef4444',borderColor:'rgba(239,68,68,0.4)',display:'inline-flex',alignItems:'center',gap:6}}>
                <Trash2 size={14} /> Delete All ({filteredItems.length})
              </button>
            )}
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{width: 40}}><input type="checkbox" checked={allItemsSelected} onChange={toggleSelectAllItems} aria-label="Select all items"/></th>
                <th>Title</th>
                <th>Category</th>
                <th>Publication</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Shimmer skeleton loading state for fast perception
                Array.from({length: 4}).map((_, i) => (
                  <tr key={'skel-' + i}>
                    <td colSpan={5} style={{padding: '12px 24px'}}>
                      <div className="skeleton-row" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length > 0 ? (
                filteredItems.map(x => (
                  <tr key={x.id}>
                    <td><input type="checkbox" checked={selectedItemIds.has(x.id)} onChange={() => toggleSelectItem(x.id)} aria-label={`Select ${x.title}`}/></td>
                    <td>
                      <strong>{x.title}</strong>
                      <small className="table-sub">{x.id}</small>
                    </td>
                    <td>
                      <span className="capitalize">{x.category.replaceAll('-', ' ')}</span>
                      {'pinned' in x && (x as Announcement).pinned ? <span className="tag tag-green">Pinned</span> : null}
                    </td>
                    <td>
                      <span className={'tag ' + (x.published ? 'tag-green' : 'tag-gray')}>
                        {x.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td>
                      <button className="text-link" onClick={() => openEdit(x)}>
                        Edit
                      </button>
                      <button className="text-link" onClick={() => setDeletingItem(x)}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="empty-state">
                    No records found. Click &ldquo;Add new&rdquo; above to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULL MODAL PAGE (NOT A MODAL POP UP) */}
      {current && (() => {
        const prog = isProgramme && 'fee' in current ? (current as Programme) : null;
        const ann = !isProgramme && 'body' in current ? (current as Announcement) : null;
        return (
        <div
          className="modal-page-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-page-title"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setConfirmingDiscard(true);
            }
          }}
        >
          <div className="modal-page">
            {/* Modal Page Top Header */}
            <div className="modal-page-header">
              <div className="modal-page-header-left">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setCurrent(null)}
                  title="Back to list (Esc)"
                  aria-label="Back to list"
                >
                  <ArrowLeft size={19} />
                </button>
                <div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                    <span className="overline" style={{color: '#2a7550', margin: 0}}>
                      {isProgramme ? 'PROGRAMME EDITOR' : 'ANNOUNCEMENT EDITOR'}
                    </span>
                    <span className={'tag ' + (current.published ? 'tag-green' : 'tag-gray')}>
                      {current.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <h2 id="modal-page-title">
                    {editing
                      ? `Edit ${isProgramme ? 'Programme' : 'Announcement'}: ${current.title || 'Untitled'}`
                      : `Create New ${isProgramme ? 'Programme' : 'Announcement'}`}
                  </h2>
                </div>
              </div>

              <div className="modal-page-header-right">
                {editing && (
                  <a
                    className="btn btn-outline"
                    href={'/' + kind + '/' + current.id}
                    target="_blank"
                    rel="noreferrer"
                    style={{fontSize: 12, padding: '8px 14px', minHeight: 36}}
                  >
                    <ExternalLink size={14} /> Public page ↗
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setCurrent(null)}
                  style={{fontSize: 12, padding: '8px 14px', minHeight: 36}}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !current.id || !current.title}
                  onClick={() => void save()}
                  style={{fontSize: 12, padding: '8px 16px', minHeight: 36}}
                >
                  <Save size={15} /> {busy ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setCurrent(null)}
                  aria-label="Close"
                  style={{marginLeft: 4}}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Page Navigation Tabs */}
            <div className="modal-page-tabs">
              {isProgramme ? (
                <>
                  <button
                    type="button"
                    className={`modal-page-tab-btn ${modalTab === 'basic' ? 'active' : ''}`}
                    onClick={() => setModalTab('basic')}
                  >
                    <BookOpen size={16} /> 1. Overview & General Info
                  </button>
                  <button
                    type="button"
                    className={`modal-page-tab-btn ${modalTab === 'modules' ? 'active' : ''}`}
                    onClick={() => setModalTab('modules')}
                  >
                    <Layers size={16} /> 2. Modules & Curriculum ({'modules' in current ? (current as Programme).modules.length : 0})
                  </button>
                  <button
                    type="button"
                    className={`modal-page-tab-btn ${modalTab === 'requirements' ? 'active' : ''}`}
                    onClick={() => setModalTab('requirements')}
                  >
                    <GraduationCap size={16} /> 3. Entry & Certification
                  </button>
                  <button
                    type="button"
                    className={`modal-page-tab-btn ${modalTab === 'fees' ? 'active' : ''}`}
                    onClick={() => setModalTab('fees')}
                  >
                    <DollarSign size={16} /> 4. Fees Structure (ZMW)
                  </button>
                  <button
                    type="button"
                    className={`modal-page-tab-btn ${modalTab === 'custom' ? 'active' : ''}`}
                    onClick={() => setModalTab('custom')}
                  >
                    <Tag size={16} /> 5. Custom Fields & Metadata ({Object.keys((prog?.customFields as Record<string, string>) || {}).length})
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={`modal-page-tab-btn ${modalTab === 'basic' ? 'active' : ''}`}
                    onClick={() => setModalTab('basic')}
                  >
                    <FileText size={16} /> 1. Announcement Details
                  </button>
                  <button
                    type="button"
                    className={`modal-page-tab-btn ${modalTab === 'body' ? 'active' : ''}`}
                    onClick={() => setModalTab('body')}
                  >
                    <BookOpen size={16} /> 2. Full Announcement Text
                  </button>
                  <button
                    type="button"
                    className={`modal-page-tab-btn ${modalTab === 'schedule' ? 'active' : ''}`}
                    onClick={() => setModalTab('schedule')}
                  >
                    <Calendar size={16} /> 3. Schedule & Visibility
                  </button>
                  <button
                    type="button"
                    className={`modal-page-tab-btn ${modalTab === 'custom' ? 'active' : ''}`}
                    onClick={() => setModalTab('custom')}
                  >
                    <Tag size={16} /> 4. Custom Fields & Metadata ({Object.keys((ann?.customFields as Record<string, string>) || {}).length})
                  </button>
                </>
              )}
            </div>

            {/* Error / Notification banner inside Modal Page */}
            {error && (
              <div style={{margin: '16px 28px 0'}}>
                <div className="alert-error">{error}</div>
              </div>
            )}

            {/* Modal Page Body Content */}
            <div className="modal-page-body">
              {prog ? (
                <>
                  {/* TAB 1: BASIC INFORMATION */}
                  {modalTab === 'basic' && (
                    <div className="modal-page-card">
                      <h3>
                        <BookOpen size={18} /> General Programme Information
                      </h3>
                      <p>Define the public listing details, permanent URL slug, category, and course duration.</p>

                      <div className="form-grid">
                        <div className="field">
                          <label>
                            Permanent URL ID <span className="required">*</span>
                          </label>
                          <input
                            disabled={editing}
                            placeholder="e.g. general-agriculture-level-3"
                            value={prog.id}
                            onChange={e =>
                              editField('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                            }
                          />
                          <small className="field-hint">
                            Permanent identifier used for the URL (/programmes/{prog.id || 'id'}). Cannot be changed after creation.
                          </small>
                        </div>

                        <div className="field">
                          <label>
                            Programme Title <span className="required">*</span>
                          </label>
                          <input
                            placeholder="e.g. General Agriculture Trade Test Level III"
                            value={prog.title}
                            onChange={e => {
                              const title = e.target.value;
                              editField('title', title);
                              if (!editing && !prog.id) {
                                editField(
                                  'id',
                                  title
                                    .toLowerCase()
                                    .trim()
                                    .replace(/[^a-z0-9]+/g, '-')
                                    .replace(/^-|-$/g, '')
                                );
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="form-grid" style={{marginTop: 12}}>
                        <div className="field">
                          <label>Programme Category</label>
                          <select
                            value={prog.category}
                            onChange={e => editField('category', e.target.value as Programme['category'])}
                          >
                            <option value="main">Main programme</option>
                            <option value="agri-sport">AGRI-SPORT pathway</option>
                            <option value="short-course">Independent short course</option>
                          </select>
                        </div>

                        <div className="field">
                          <label>Duration</label>
                          <input
                            placeholder="e.g. 6 Months (740 hrs) or 8 Weeks"
                            value={prog.duration}
                            onChange={e => editField('duration', e.target.value)}
                          />
                        </div>

                        <div className="field">
                          <label>Contact Hours (optional)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="e.g. 740"
                            value={prog.durationHours ?? ''}
                            onChange={e =>
                              editField('durationHours', e.target.value === '' ? null : Number(e.target.value))
                            }
                          />
                        </div>
                      </div>

                      <div className="field" style={{marginTop: 12}}>
                        <label>Short Description (Summary)</label>
                        <textarea
                          rows={3}
                          placeholder="Provide a compelling overview of this course for prospective students and applicants."
                          value={prog.description}
                          onChange={e => editField('description', e.target.value)}
                        />
                      </div>

                      <div style={{background: '#f4f9f6', padding: '16px 20px', borderRadius: 10, marginTop: 18}}>
                        <label className="required-toggle" style={{margin: 0, fontSize: 13, fontWeight: 700}}>
                          <input
                            type="checkbox"
                            checked={prog.published}
                            onChange={e => editField('published', e.target.checked)}
                          />
                          Publish this programme on KASA public website and application forms
                        </label>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: MODULES & CURRICULUM */}
                  {modalTab === 'modules' && (
                    <div className="modal-page-card">
                      <h3>
                        <Layers size={18} /> Modules & Learning Topics
                      </h3>
                      <p>
                        Outline the modules, subjects, and practical competencies covered in this course. Enter one module per line.
                      </p>

                      <div className="field">
                        <label>Modules / Syllabus Topics (one item per line)</label>
                        <textarea
                          rows={10}
                          placeholder="e.g.&#10;Soil Science and Plant Nutrition&#10;Irrigation and Water Harvesting&#10;Crop Protection and Pest Management&#10;Farm Machinery Maintenance&#10;Agribusiness and Farm Accounting"
                          value={prog.modules.join('\n')}
                          onChange={e =>
                            editField(
                              'modules',
                              e.target.value
                                .split('\n')
                                .map(x => x.trim())
                                .filter(Boolean)
                            )
                          }
                          style={{fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6}}
                        />
                      </div>

                      <div style={{marginTop: 14}}>
                        <span className="count-chip">{prog.modules.length} modules configured</span>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: REQUIREMENTS & CERTIFICATION */}
                  {modalTab === 'requirements' && (
                    <div className="modal-page-card">
                      <h3>
                        <GraduationCap size={18} /> Admission Criteria & Qualifications
                      </h3>
                      <p>Specify entry requirements, academic prerequisites, and official certification awarded.</p>

                      <div className="field">
                        <label>Admission Requirements</label>
                        <textarea
                          rows={4}
                          placeholder="e.g. Grade 9 or Grade 12 Certificate with passes in English and Mathematics, or recognized prior learning experience in agriculture."
                          value={prog.requirements}
                          onChange={e => editField('requirements', e.target.value)}
                        />
                      </div>

                      <div className="field" style={{marginTop: 16}}>
                        <label>Certification and Qualification Status</label>
                        <textarea
                          rows={4}
                          placeholder="e.g. TEVETA Trade Test Level III Certificate upon successful external assessment and practical examination."
                          value={prog.certification}
                          onChange={e => editField('certification', e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 4: FEES STRUCTURE */}
                  {modalTab === 'fees' && (
                    <div className="modal-page-card">
                      <h3>
                        <DollarSign size={18} /> Proposed Course Fee Components (ZMW)
                      </h3>
                      <p>
                        Break down tuition, practical, accommodation and meal components. Leave blank if not confirmed or inclusive.
                      </p>

                      <div className="form-grid">
                        {(
                          [
                            'tuition',
                            'practical',
                            'administration',
                            'foodOptional',
                            'accommodationOptional',
                            'packageTotal'
                          ] as const
                        ).map(k => (
                          <div className="field" key={k}>
                            <label>
                              {(
                                {
                                  tuition: 'Tuition Fee (ZMW)',
                                  practical: 'Practical / Lab Fee (ZMW)',
                                  administration: 'Administration / Exam Fee (ZMW)',
                                  foodOptional: 'Food & Meals (Optional, ZMW)',
                                  accommodationOptional: 'Accommodation / Hostel (Optional, ZMW)',
                                  packageTotal: 'Full Proposed Package (ZMW)'
                                }
                              )[k]}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={prog.fee[k] ?? ''}
                              onChange={e => feeField(k, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="field" style={{marginTop: 16}}>
                        <label>Fee Conditions & Payment Notes</label>
                        <textarea
                          rows={3}
                          placeholder="e.g. Instalment payment terms: 40% registration deposit, 30% midterm, 30% before examinations. Hostel space is optional and subject to availability."
                          value={prog.fee.note}
                          onChange={e => feeField('note', e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 5: CUSTOM FIELDS & METADATA */}
                  {modalTab === 'custom' && (
                    <div className="modal-page-card">
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16}}>
                        <div>
                          <h3 style={{margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8}}>
                            <Tag size={18} /> Custom Programme Fields & Metadata
                          </h3>
                          <p className="muted" style={{margin: '4px 0 0'}}>
                            Add custom attributes, campus locations, equipment prerequisites, or intake details for this course.
                          </p>
                        </div>
                        <button type="button" className="btn btn-outline" onClick={addCustomField} style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                          <Plus size={15} /> Add Custom Field
                        </button>
                      </div>

                      {Object.keys((prog.customFields as Record<string, string>) || {}).length === 0 ? (
                        <div className="empty-panel" style={{padding: '30px 20px', textAlign: 'center'}}>
                          <Tag size={32} style={{color: 'var(--muted)', opacity: 0.5, marginBottom: 8}} />
                          <p style={{margin: 0, fontWeight: 600}}>No custom fields configured for this programme.</p>
                          <small className="muted">Click &ldquo;Add Custom Field&rdquo; above to add tailored attributes or course metadata.</small>
                        </div>
                      ) : (
                        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
                          {Object.entries((prog.customFields as Record<string, string>) || {}).map(([key, val], idx) => (
                            <div key={`cf-${idx}-${key}`} style={{display: 'flex', gap: 12, alignItems: 'flex-start', background: '#f8faf9', padding: 14, borderRadius: 10, border: '1px solid var(--border)'}}>
                              <div style={{flex: 1}}>
                                <label style={{fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block'}}>Field Name / Key</label>
                                <input
                                  type="text"
                                  placeholder="Field Name (e.g. Campus Location)"
                                  value={key}
                                  onChange={e => updateCustomFieldKey(key, e.target.value)}
                                  style={{fontSize: 13}}
                                />
                              </div>
                              <div style={{flex: 2}}>
                                <label style={{fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block'}}>Field Value / Content</label>
                                <textarea
                                  rows={2}
                                  placeholder="Field Value (e.g. Lusaka Main Campus & Practical Farm Site)"
                                  value={String(val || '')}
                                  onChange={e => updateCustomFieldValue(key, e.target.value)}
                                  style={{fontSize: 13, lineHeight: 1.5}}
                                />
                              </div>
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => removeCustomField(key)}
                                title="Remove custom field"
                                style={{color: '#ef4444', marginTop: 24, padding: 8}}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : ann ? (
                <>
                  {/* ANNOUNCEMENT TAB 1: BASIC DETAILS */}
                  {modalTab === 'basic' && (
                    <div className="modal-page-card">
                      <h3>
                        <FileText size={18} /> Announcement Overview
                      </h3>
                      <p>Configure headline, category, excerpt summary and public visibility.</p>

                      <div className="form-grid">
                        <div className="field">
                          <label>
                            Permanent URL ID <span className="required">*</span>
                          </label>
                          <input
                            disabled={editing}
                            placeholder="e.g. 2027-intake-admissions-open"
                            value={ann.id}
                            onChange={e =>
                              editField('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                            }
                          />
                        </div>

                        <div className="field">
                          <label>
                            Announcement Headline <span className="required">*</span>
                          </label>
                          <input
                            placeholder="e.g. KASA Announces 2027 January Intake Admissions"
                            value={ann.title}
                            onChange={e => {
                              const title = e.target.value;
                              editField('title', title);
                              if (!editing && !ann.id) {
                                editField(
                                  'id',
                                  title
                                    .toLowerCase()
                                    .trim()
                                    .replace(/[^a-z0-9]+/g, '-')
                                    .replace(/^-|-$/g, '')
                                );
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="form-grid" style={{marginTop: 12}}>
                        <div className="field">
                          <label>Category</label>
                          <select
                            value={ann.category}
                            onChange={e => editField('category', e.target.value as Announcement['category'])}
                          >
                            {['admissions', 'academic', 'cdf', 'agents', 'general'].map(c => (
                              <option value={c} key={c}>
                                {c.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="field" style={{justifyContent: 'center'}}>
                          <label className="required-toggle" style={{marginTop: 20}}>
                            <input
                              type="checkbox"
                              checked={ann.pinned}
                              onChange={e => editField('pinned', e.target.checked)}
                            />
                            Pin announcement to top of website
                          </label>
                        </div>
                      </div>

                      <div className="field" style={{marginTop: 12}}>
                        <label>Short Excerpt / Teaser</label>
                        <textarea
                          rows={3}
                          placeholder="Brief summary displayed on announcement cards and social preview cards."
                          value={ann.description}
                          onChange={e => editField('description', e.target.value)}
                        />
                      </div>

                      <div style={{background: '#f4f9f6', padding: '16px 20px', borderRadius: 10, marginTop: 18}}>
                        <label className="required-toggle" style={{margin: 0, fontSize: 13, fontWeight: 700}}>
                          <input
                            type="checkbox"
                            checked={ann.published}
                            onChange={e => editField('published', e.target.checked)}
                          />
                          Publish this announcement on KASA public website
                        </label>
                      </div>
                    </div>
                  )}

                  {/* ANNOUNCEMENT TAB 2: FULL BODY */}
                  {modalTab === 'body' && (
                    <div className="modal-page-card">
                      <h3>
                        <BookOpen size={18} /> Official Announcement Body
                      </h3>
                      <p>Write the complete announcement content. Plain text or markdown formatting is supported.</p>

                      <div className="field">
                        <label>Full Announcement Article</label>
                        <textarea
                          rows={14}
                          placeholder="Write the full announcement text here…"
                          value={ann.body}
                          onChange={e => editField('body', e.target.value)}
                          style={{lineHeight: 1.6, fontSize: 14}}
                        />
                      </div>
                    </div>
                  )}

                  {/* ANNOUNCEMENT TAB 3: SCHEDULE */}
                  {modalTab === 'schedule' && (
                    <div className="modal-page-card">
                      <h3>
                        <Calendar size={18} /> Schedule & Expiry Controls
                      </h3>
                      <p>Optionally schedule an automatic publishing date and expiry cutoff time.</p>

                      <div className="form-grid">
                        <div className="field">
                          <label>Publish From Date & Time (optional)</label>
                          <input
                            type="datetime-local"
                            value={dateInput(ann.publishedAt)}
                            onChange={e =>
                              editField('publishedAt', e.target.value ? new Date(e.target.value).toISOString() : null)
                            }
                          />
                          <small className="field-hint">Leave blank to publish immediately upon saving.</small>
                        </div>

                        <div className="field">
                          <label>Expire At Date & Time (optional)</label>
                          <input
                            type="datetime-local"
                            value={dateInput(ann.expiresAt)}
                            onChange={e =>
                              editField('expiresAt', e.target.value ? new Date(e.target.value).toISOString() : null)
                            }
                          />
                          <small className="field-hint">Leave blank for no expiration date.</small>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ANNOUNCEMENT TAB 4: CUSTOM FIELDS & METADATA */}
                  {modalTab === 'custom' && (
                    <div className="modal-page-card">
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16}}>
                        <div>
                          <h3 style={{margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8}}>
                            <Tag size={18} /> Custom Announcement Fields & Metadata
                          </h3>
                          <p className="muted" style={{margin: '4px 0 0'}}>
                            Add custom metadata attributes, external references, or venue details to this announcement.
                          </p>
                        </div>
                        <button type="button" className="btn btn-outline" onClick={addCustomField} style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
                          <Plus size={15} /> Add Custom Field
                        </button>
                      </div>

                      {Object.keys((ann.customFields as Record<string, string>) || {}).length === 0 ? (
                        <div className="empty-panel" style={{padding: '30px 20px', textAlign: 'center'}}>
                          <Tag size={32} style={{color: 'var(--muted)', opacity: 0.5, marginBottom: 8}} />
                          <p style={{margin: 0, fontWeight: 600}}>No custom fields configured for this announcement.</p>
                          <small className="muted">Click &ldquo;Add Custom Field&rdquo; above to add custom attributes.</small>
                        </div>
                      ) : (
                        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
                          {Object.entries((ann.customFields as Record<string, string>) || {}).map(([key, val], idx) => (
                            <div key={`cf-ann-${idx}-${key}`} style={{display: 'flex', gap: 12, alignItems: 'flex-start', background: '#f8faf9', padding: 14, borderRadius: 10, border: '1px solid var(--border)'}}>
                              <div style={{flex: 1}}>
                                <label style={{fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block'}}>Field Name / Key</label>
                                <input
                                  type="text"
                                  placeholder="Field Name (e.g. Venue / Contact Person)"
                                  value={key}
                                  onChange={e => updateCustomFieldKey(key, e.target.value)}
                                  style={{fontSize: 13}}
                                />
                              </div>
                              <div style={{flex: 2}}>
                                <label style={{fontSize: 12, fontWeight: 700, marginBottom: 4, display: 'block'}}>Field Value / Content</label>
                                <textarea
                                  rows={2}
                                  placeholder="Field Value / Content"
                                  value={String(val || '')}
                                  onChange={e => updateCustomFieldValue(key, e.target.value)}
                                  style={{fontSize: 13, lineHeight: 1.5}}
                                />
                              </div>
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => removeCustomField(key)}
                                title="Remove custom field"
                                style={{color: '#ef4444', marginTop: 24, padding: 8}}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Page Sticky Footer */}
            <div className="modal-page-footer">
              <div>
                {editing && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setDeletingItem(current)}
                    style={{color: '#c14931', borderColor: '#f5d2ca'}}
                  >
                    <Trash2 size={15} /> Delete record
                  </button>
                )}
              </div>

              <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                <button type="button" className="btn btn-outline" onClick={() => setCurrent(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !current.id || !current.title}
                  onClick={() => void save()}
                  style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
                >
                  <Save size={16} /> {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      <ConfirmModal
        isOpen={Boolean(deletingItem)}
        title="Delete Record"
        message={`Are you sure you want to permanently delete "${deletingItem?.title}"?`}
        kind="danger"
        confirmLabel="Delete Record"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setDeletingItem(null)}
      />

      <ConfirmModal
        isOpen={Boolean(bulkDeleteTarget)}
        title="Delete Multiple Records"
        message={`Are you sure you want to permanently delete ${bulkDeleteTarget === 'selected' ? `${selectedItemIds.size} selected` : `all ${filteredItems.length}`} record(s)?`}
        kind="danger"
        confirmLabel="Delete Records"
        cancelLabel="Cancel"
        busy={busy}
        onConfirm={() => void confirmBulkDeleteContent()}
        onCancel={() => setBulkDeleteTarget(null)}
      />

      <ConfirmModal
        isOpen={confirmingDiscard}
        title="Discard Changes"
        message="Are you sure you want to discard unsaved changes and close the editor?"
        kind="confirm"
        confirmLabel="Discard & Close"
        cancelLabel="Keep Editing"
        onConfirm={() => {
          setConfirmingDiscard(false);
          setCurrent(null);
        }}
        onCancel={() => setConfirmingDiscard(false)}
      />
    </>
  );
}
