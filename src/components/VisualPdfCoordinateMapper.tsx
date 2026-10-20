'use client';

import {useState, useRef, useEffect, useCallback} from 'react';
import {
  Move, Sliders, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Eye, RefreshCw, ZoomIn, ZoomOut, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';
import type {AcceptanceLetterConfig} from '@/lib/acceptance-letter-config';
import {authHeaders} from '@/lib/firebase-client';

type PageNumber = 1 | 2 | 3;

type FieldGroup = {
  key: keyof AcceptanceLetterConfig['enrollmentFormOffsets'];
  label: string;
  page: PageNumber;
  category: string;
};

const ENROLLMENT_FORM_FIELDS: FieldGroup[] = [
  // PAGE 1
  {key: 'applicationDate', label: 'Application Date', page: 1, category: 'Top Header'},
  {key: 'intakeAndYear', label: 'Intake & Year', page: 1, category: 'Top Header'},
  {key: 'programmeTitle', label: 'Programme Title', page: 1, category: 'Section 1: Programme'},
  {key: 'fullNames', label: 'Student Full Name', page: 1, category: 'Section 2: Personal'},
  {key: 'dob', label: 'Date of Birth', page: 1, category: 'Section 2: Personal'},
  {key: 'gender', label: 'Sex / Gender', page: 1, category: 'Section 2: Personal'},
  {key: 'nationality', label: 'Nationality', page: 1, category: 'Section 2: Personal'},
  {key: 'nrcNumber', label: 'NRC / Passport No.', page: 1, category: 'Section 2: Personal'},
  {key: 'mobileNumber', label: 'Mobile Number', page: 1, category: 'Section 2: Personal'},
  {key: 'whatsappNumber', label: 'WhatsApp Number', page: 1, category: 'Section 2: Personal'},
  {key: 'email', label: 'Email Address', page: 1, category: 'Section 2: Personal'},
  {key: 'residentialAddress', label: 'Residential Address', page: 1, category: 'Section 2: Personal'},
  {key: 'district', label: 'District / Town', page: 1, category: 'Section 2: Personal'},
  {key: 'province', label: 'Province', page: 1, category: 'Section 2: Personal'},
  {key: 'highestGrade', label: 'Highest Grade / Qualification', page: 1, category: 'Section 3: Education'},
  {key: 'schoolInstitution', label: 'School / Institution Name', page: 1, category: 'Section 3: Education'},
  {key: 'qualificationYear', label: 'Year Completed', page: 1, category: 'Section 3: Education'},

  // PAGE 2
  {key: 'occupation', label: 'Current Occupation', page: 2, category: 'Section 4: Employment'},
  {key: 'guardianName', label: 'Parent / Guardian Name', page: 2, category: 'Section 5: Next of Kin'},
  {key: 'guardianRelationship', label: 'Relationship', page: 2, category: 'Section 5: Next of Kin'},
  {key: 'guardianMobile', label: 'Guardian Phone', page: 2, category: 'Section 5: Next of Kin'},
  {key: 'emergencyName', label: 'Emergency Contact Name', page: 2, category: 'Section 5: Emergency'},
  {key: 'emergencyMobile', label: 'Emergency Phone', page: 2, category: 'Section 5: Emergency'},
  {key: 'sponsorName', label: 'Sponsor / CDF Payer Name', page: 2, category: 'Section 6: Sponsorship'},

  // PAGE 3
  {key: 'declarationName', label: 'Applicant Signature Name', page: 3, category: 'Section 7: Declaration'},
  {key: 'declarationDate', label: 'Declaration Date', page: 3, category: 'Section 7: Declaration'},
  {key: 'officeReference', label: 'Office Offer Reference', page: 3, category: 'For Office Use Only'},
  {key: 'officeEnrollmentNum', label: 'Office Enrollment No.', page: 3, category: 'For Office Use Only'},
  {key: 'officeConfirmedProg', label: 'Office Confirmed Course', page: 3, category: 'For Office Use Only'},
  {key: 'officeIntakeDate', label: 'Office Intake Date', page: 3, category: 'For Office Use Only'}
];

interface Props {
  config: AcceptanceLetterConfig;
  onChange: (updatedConfig: AcceptanceLetterConfig) => void;
  onPreviewPdf: () => void;
  previewing?: boolean;
}

export function VisualPdfCoordinateMapper({config, onChange, onPreviewPdf, previewing}: Props) {
  const [activePage, setActivePage] = useState<PageNumber>(1);
  const [selectedFieldKey, setSelectedFieldKey] = useState<keyof AcceptanceLetterConfig['enrollmentFormOffsets']>('fullNames');
  const [draggingKey, setDraggingKey] = useState<keyof AcceptanceLetterConfig['enrollmentFormOffsets'] | null>(null);
  const [scale, setScale] = useState<number>(0.9);
  const [renderingPdf, setRenderingPdf] = useState(false);
  const [pdfRendered, setPdfRendered] = useState(false);
  const [renderError, setRenderError] = useState('');

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  const PDF_WIDTH = 595;
  const PDF_HEIGHT = 842;

  const pageFields = ENROLLMENT_FORM_FIELDS.filter(f => f.page === activePage);

  function pdfToDomCoords(pdfX: number, pdfY: number) {
    const domX = pdfX * scale;
    const domY = (PDF_HEIGHT - pdfY) * scale;
    return {left: domX, top: domY};
  }

  const updateFieldOffset = useCallback((
    key: keyof AcceptanceLetterConfig['enrollmentFormOffsets'],
    updates: Partial<{x: number; y: number; fontSize: number}>
  ) => {
    const current = config.enrollmentFormOffsets[key] || {x: 100, y: 500, fontSize: 9};
    const updated = {
      ...config,
      enrollmentFormOffsets: {
        ...config.enrollmentFormOffsets,
        [key]: {
          ...current,
          ...updates
        }
      }
    };
    onChange(updated);
  }, [config, onChange]);

  // Load PDF.js dynamically in browser
  useEffect(() => {
    if ((window as any).pdfjsLib) return;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    };
    document.body.appendChild(script);
  }, []);

  // Render actual live PDF page image on background canvas
  const renderActualPdfPage = useCallback(async () => {
    setRenderingPdf(true);
    setRenderError('');
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/admin/settings/acceptance-letter/preview-enrollment-form', {
        method: 'POST',
        headers: {...headers, 'Content-Type': 'application/json'},
        body: JSON.stringify({config})
      });

      if (!res.ok) {
        throw new Error('Failed to generate live PDF preview');
      }

      const pdfArrayBuffer = await res.arrayBuffer();
      const pdfjs = (window as any).pdfjsLib;

      if (pdfjs && pdfCanvasRef.current) {
        const pdfDoc = await pdfjs.getDocument({data: pdfArrayBuffer}).promise;
        const page = await pdfDoc.getPage(activePage);

        const canvas = pdfCanvasRef.current;
        const ctx = canvas.getContext('2d');

        const viewport = page.getViewport({scale: scale * 1.5});
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (ctx) {
          await page.render({canvasContext: ctx, viewport}).promise;
          setPdfRendered(true);
        }
      }
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Unable to render live PDF canvas.');
    } finally {
      setRenderingPdf(false);
    }
  }, [config, activePage, scale]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void renderActualPdfPage();
    }, 300);
    return () => clearTimeout(timer);
  }, [renderActualPdfPage]);

  // Handle Mouse Dragging
  const handleMouseDown = (key: keyof AcceptanceLetterConfig['enrollmentFormOffsets'], e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFieldKey(key);
    setDraggingKey(key);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingKey || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const domLeft = e.clientX - rect.left;
    const domTop = e.clientY - rect.top;
    const pdfX = Math.round(Math.max(10, Math.min(560, domLeft / scale)));
    const pdfY = Math.round(Math.max(10, Math.min(820, PDF_HEIGHT - (domTop / scale))));
    updateFieldOffset(draggingKey, {x: pdfX, y: pdfY});
  }, [draggingKey, scale, updateFieldOffset]);

  const handleMouseUp = useCallback(() => {
    setDraggingKey(null);
  }, []);

  useEffect(() => {
    if (draggingKey) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingKey, handleMouseMove, handleMouseUp]);

  const nudge = (dx: number, dy: number) => {
    if (!selectedFieldKey) return;
    const cur = config.enrollmentFormOffsets[selectedFieldKey] || {x: 100, y: 500, fontSize: 9};
    updateFieldOffset(selectedFieldKey, {
      x: Math.max(0, Math.min(580, cur.x + dx)),
      y: Math.max(0, Math.min(830, cur.y + dy))
    });
  };

  const selectedFieldObj = ENROLLMENT_FORM_FIELDS.find(f => f.key === selectedFieldKey);
  const selectedOffset = config.enrollmentFormOffsets[selectedFieldKey] || {x: 100, y: 500, fontSize: 9};

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
      {/* Top Bar Controls */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#ffffff', padding: '14px 20px', borderRadius: 12,
        border: '1px solid var(--border)', flexWrap: 'wrap', gap: 12
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{fontSize: 13, fontWeight: 700, color: 'var(--ink)'}}>Page View:</span>
          <div className="tab-group" style={{margin: 0}}>
            <button
              type="button"
              className={`btn btn-sm ${activePage === 1 ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setActivePage(1); setSelectedFieldKey('fullNames'); }}
            >
              Page 1: Personal & Course
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activePage === 2 ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setActivePage(2); setSelectedFieldKey('guardianName'); }}
            >
              Page 2: Guardian & Sponsor
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activePage === 3 ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setActivePage(3); setSelectedFieldKey('declarationName'); }}
            >
              Page 3: Office & Declaration
            </button>
          </div>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'}}>
          <button
            type="button"
            className="btn btn-outline"
            disabled={renderingPdf}
            onClick={() => void renderActualPdfPage()}
            style={{display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 12px'}}
          >
            <RefreshCw size={14} className={renderingPdf ? 'spin' : ''} /> {renderingPdf ? 'Rendering PDF…' : 'Update Live Canvas'}
          </button>

          <div style={{display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f3', padding: '2px 8px', borderRadius: 8}}>
            <button type="button" className="icon-btn" onClick={() => setScale(s => Math.max(0.6, s - 0.1))} title="Zoom out">
              <ZoomOut size={16} />
            </button>
            <span style={{fontSize: 12, fontWeight: 700, minWidth: 42, textAlign: 'center'}}>{Math.round(scale * 100)}%</span>
            <button type="button" className="icon-btn" onClick={() => setScale(s => Math.min(1.2, s + 0.1))} title="Zoom in">
              <ZoomIn size={16} />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            disabled={previewing}
            onClick={onPreviewPdf}
            style={{display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13}}
          >
            <Eye size={16} /> {previewing ? 'Generating…' : 'Full PDF Preview ↗'}
          </button>
        </div>
      </div>

      {/* Grid: Live PDF Canvas on Left, Nudge Panel on Right */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start'}}>
        {/* Left Column: ACTUAL RENDERED LIVE PDF DOCUMENT CANVAS */}
        <div style={{
          background: '#334155', padding: 24, borderRadius: 12,
          border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center',
          overflow: 'auto', minHeight: 620
        }}>
          {renderingPdf && (
            <div style={{fontSize: 12, color: '#e2e8f0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6}}>
              <RefreshCw size={14} className="spin" /> Rendering actual live PDF document background…
            </div>
          )}
          {renderError && (
            <div style={{fontSize: 12, color: '#f87171', marginBottom: 12}}>
              {renderError} (Falling back to document grid)
            </div>
          )}

          <div
            ref={canvasContainerRef}
            style={{
              width: PDF_WIDTH * scale,
              height: PDF_HEIGHT * scale,
              position: 'relative',
              background: '#ffffff',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              borderRadius: 4,
              overflow: 'hidden',
              userSelect: 'none'
            }}
          >
            {/* The Actual Rendered Live PDF Document Canvas */}
            <canvas
              ref={pdfCanvasRef}
              style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: pdfRendered ? 1 : 0.2
              }}
            />

            {/* Draggable Field Tag Overlays Directly On Top of the Live PDF Document */}
            {pageFields.map(f => {
              const offset = config.enrollmentFormOffsets[f.key] || {x: 100, y: 500, fontSize: 9};
              const domPos = pdfToDomCoords(offset.x, offset.y);
              const isSelected = selectedFieldKey === f.key;
              const isDragging = draggingKey === f.key;

              return (
                <div
                  key={f.key}
                  onMouseDown={e => handleMouseDown(f.key, e)}
                  style={{
                    position: 'absolute',
                    left: domPos.left,
                    top: domPos.top,
                    transform: 'translate(-10px, -12px)',
                    zIndex: isDragging ? 100 : isSelected ? 50 : 10,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: isSelected ? 'var(--green, #103f2c)' : 'rgba(16, 63, 44, 0.88)',
                    color: '#ffffff',
                    boxShadow: isSelected ? '0 4px 12px rgba(16,63,44,0.4)' : '0 2px 6px rgba(0,0,0,0.2)',
                    border: isSelected ? '2px solid #e0b561' : '1px solid #ffffff',
                    fontSize: Math.max(9, Math.round(offset.fontSize * scale)),
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    transition: isDragging ? 'none' : 'all 0.1s ease'
                  }}
                >
                  <Move size={12 * scale} />
                  <span>{f.label}</span>
                  <span style={{
                    fontSize: 8 * scale,
                    background: 'rgba(255,255,255,0.2)',
                    padding: '1px 4px',
                    borderRadius: 3,
                    fontFamily: 'monospace'
                  }}>
                    X:{offset.x} Y:{offset.y}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Precision Nudge Controls */}
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          {selectedFieldObj ? (
            <div className="panel pad-panel" style={{borderLeft: '4px solid var(--green, #103f2c)'}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10}}>
                <span className="overline" style={{margin: 0, color: 'var(--green)'}}>DRAGGED FIELD</span>
                <span className="tag tag-gray" style={{fontSize: 11}}>Page {selectedFieldObj.page}</span>
              </div>
              <h3 style={{margin: '0 0 4px', fontSize: 16}}>{selectedFieldObj.label}</h3>
              <p className="muted" style={{fontSize: 12, margin: '0 0 16px'}}>{selectedFieldObj.category}</p>

              <div className="form-grid" style={{marginBottom: 16}}>
                <div className="field">
                  <label>X Position (pt)</label>
                  <input
                    type="number"
                    min="0"
                    max="580"
                    value={selectedOffset.x}
                    onChange={e => updateFieldOffset(selectedFieldKey, {x: Number(e.target.value) || 0})}
                  />
                </div>
                <div className="field">
                  <label>Y Position (pt)</label>
                  <input
                    type="number"
                    min="0"
                    max="830"
                    value={selectedOffset.y}
                    onChange={e => updateFieldOffset(selectedFieldKey, {y: Number(e.target.value) || 0})}
                  />
                </div>
                <div className="field full">
                  <label>Font Size (pt)</label>
                  <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                    <input
                      type="range"
                      min="6"
                      max="18"
                      step="0.5"
                      value={selectedOffset.fontSize || 9}
                      onChange={e => updateFieldOffset(selectedFieldKey, {fontSize: Number(e.target.value)})}
                      style={{flex: 1}}
                    />
                    <strong style={{minWidth: 36, fontSize: 13}}>{selectedOffset.fontSize || 9} pt</strong>
                  </div>
                </div>
              </div>

              {/* Nudge Arrow Directional Buttons */}
              <div style={{background: '#f8faf9', padding: 12, borderRadius: 8, border: '1px solid var(--border)'}}>
                <span style={{fontSize: 11, fontWeight: 700, display: 'block', textAlign: 'center', marginBottom: 8, color: 'var(--muted)'}}>
                  NUDGE 1px ARROWS
                </span>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, width: 120, margin: '0 auto'}}>
                  <div />
                  <button type="button" className="btn btn-outline" style={{padding: 6}} onClick={() => nudge(0, 1)} title="Nudge Up (+1 Y)">
                    <ArrowUp size={14} />
                  </button>
                  <div />
                  <button type="button" className="btn btn-outline" style={{padding: 6}} onClick={() => nudge(-1, 0)} title="Nudge Left (-1 X)">
                    <ArrowLeft size={14} />
                  </button>
                  <button type="button" className="btn btn-outline" style={{padding: 6}} onClick={() => nudge(0, -1)} title="Nudge Down (-1 Y)">
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" className="btn btn-outline" style={{padding: 6}} onClick={() => nudge(1, 0)} title="Nudge Right (+1 X)">
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Page Field List Selector */}
          <div className="panel pad-panel">
            <h3 style={{margin: '0 0 12px', fontSize: 15}}>Page {activePage} Mapped Fields</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto'}}>
              {pageFields.map(f => {
                const isSelected = selectedFieldKey === f.key;
                const offset = config.enrollmentFormOffsets[f.key] || {x: 100, y: 500, fontSize: 9};
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setSelectedFieldKey(f.key)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: isSelected ? 'rgba(16, 63, 44, 0.08)' : '#ffffff',
                      borderColor: isSelected ? 'var(--green)' : 'var(--border)',
                      cursor: 'pointer', textAlign: 'left', width: '100%'
                    }}
                  >
                    <span style={{fontSize: 13, fontWeight: isSelected ? 700 : 500, color: 'var(--ink)'}}>{f.label}</span>
                    <span style={{fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace'}}>
                      ({offset.x}, {offset.y})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
