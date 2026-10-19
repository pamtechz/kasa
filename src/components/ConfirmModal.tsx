'use client';
import {X, AlertTriangle, CheckCircle2, Trash2} from 'lucide-react';

export type ModalKind = 'confirm' | 'danger' | 'success' | 'info';

export type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  kind?: ModalKind;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
};

export function ConfirmModal({
  isOpen,
  title,
  message,
  kind = 'confirm',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  busy = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const isDanger = kind === 'danger';
  const isSuccess = kind === 'success';

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onCancel(); }}
      style={{
        zIndex: 999,
        background: 'rgba(10,35,25,0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="site-card"
        style={{
          width: 'min(480px, calc(100% - 32px))',
          padding: 28,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          background: '#fff',
          border: isDanger ? '2px solid #ef4444' : isSuccess ? '2px solid #2eb872' : '1px solid var(--border)'
        }}
      >
        <div style={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              background: isDanger ? '#fee2e2' : isSuccess ? '#e5f5eb' : '#eaf4ee',
              color: isDanger ? '#dc2626' : isSuccess ? '#26824b' : 'var(--green)',
              flexShrink: 0
            }}>
              {isDanger ? <Trash2 size={22}/> : isSuccess ? <CheckCircle2 size={22}/> : <AlertTriangle size={22}/>}
            </div>
            <div>
              <h3 style={{fontSize: 18, fontWeight: 800, margin: 0, letterSpacing: '-0.02em'}}>{title}</h3>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close dialog"
          >
            <X size={18}/>
          </button>
        </div>

        <p style={{fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: '12px 0 24px'}}>
          {message}
        </p>

        <div style={{display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap'}}>
          {kind !== 'info' && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={onCancel}
              disabled={busy}
              style={{fontSize: 13, minHeight: 38}}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={onConfirm}
            disabled={busy}
            style={{
              fontSize: 13,
              minHeight: 38,
              background: isDanger ? '#dc2626' : 'var(--green)',
              color: '#fff',
              border: 'none'
            }}
          >
            {busy ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
