'use client';

import {useState, useEffect} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {ExternalLink, Megaphone, X} from 'lucide-react';

type Ad = {
  id: string;
  headline: string;
  description: string;
  imageUrl?: string;
  targetUrl: string;
  ctaText?: string;
};

interface Props {
  placement?: 'homepage_hero' | 'programmes' | 'sidebar' | 'student_portal' | 'all';
  className?: string;
}

export function AdBanner({placement = 'all', className = ''}: Props) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch(`/api/public/ads?placement=${placement}`, {cache: 'no-store'})
      .then(res => res.json())
      .then(data => {
        if (data?.ad) setAd(data.ad);
      })
      .catch(() => {});
  }, [placement]);

  if (!ad || dismissed) return null;

  const target = ad.targetUrl || '/';
  const external = /^https?:\/\//i.test(target);
  const href = external || (target.startsWith('/') && !target.startsWith('//') && !target.includes('\\')) ? target : '/';

  function handleAdClick() {
    if (!ad) return;
    void fetch('/api/public/ads', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id: ad.id}),
      keepalive: true
    }).catch(() => {});
  }

  return (
    <div
      className={`kasa-ad-banner ${className}`}
      style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #ffffff 0%, #f4f9f6 100%)',
        border: '1.5px solid #d0e1d8',
        borderRadius: 12,
        padding: '16px 20px',
        margin: '20px 0',
        boxShadow: '0 4px 16px rgba(16,63,44,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -10,
          left: 16,
          background: 'var(--green, #103f2c)',
          color: '#ffffff',
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '0.08em',
          padding: '2px 8px',
          borderRadius: 4,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4
        }}
      >
        <Megaphone size={10} /> SPONSORED ADVERTISEMENT
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Close advertisement"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          border: 'none',
          background: 'transparent',
          color: 'var(--muted)',
          cursor: 'pointer',
          padding: 4
        }}
      >
        <X size={14} />
      </button>

      {ad.imageUrl && (
        <div style={{flexShrink: 0, position: 'relative', width: 64, height: 64, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)'}}>
          <Image src={ad.imageUrl} alt={ad.headline} fill unoptimized style={{objectFit: 'cover'}} />
        </div>
      )}

      <div style={{flex: 1, minWidth: 220}}>
        <h4 style={{margin: '4px 0 2px', fontSize: 15, color: 'var(--ink)'}}>{ad.headline}</h4>
        <p style={{margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5}}>{ad.description}</p>
      </div>

      <Link
        href={href}
        target={external?'_blank':undefined}
        rel={external?'noopener noreferrer':undefined}
        className="btn btn-sm btn-primary"
        onClick={handleAdClick}
        style={{fontSize: 12, padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0}}
      >
        {ad.ctaText || 'Learn More'} <ExternalLink size={13} />
      </Link>
    </div>
  );
}
