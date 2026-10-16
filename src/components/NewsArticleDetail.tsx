'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, Clock, User, Share2, Check,
  BookOpen, Sparkles, ArrowRight, ExternalLink
} from 'lucide-react';
import type {Announcement} from '@/lib/content';

function estimateReadTime(text: string): string {
  const words = text ? text.split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(words / 180));
  return `${minutes} min read`;
}

export function NewsArticleDetail({id}: {id: string}) {
  const [article, setArticle] = useState<Announcement | null>(null);
  const [related, setRelated] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/public/content/announcements/${encodeURIComponent(id)}`, {cache: 'no-store'})
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw Error(data.error || 'Article not found');
        setArticle(data.item);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));

    // Also fetch other articles for related list
    fetch('/api/public/content?kind=announcements', {cache: 'no-store'})
      .then(async res => {
        const data = await res.json();
        if (data?.items) {
          setRelated(data.items.filter((x: Announcement) => x.id !== id).slice(0, 3));
        }
      })
      .catch(() => {});
  }, [id]);

  function copyLink() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  function shareWhatsApp() {
    if (typeof window !== 'undefined' && article) {
      const url = encodeURIComponent(window.location.href);
      const text = encodeURIComponent(`${article.title} - KASA News & Blog: `);
      window.open(`https://api.whatsapp.com/send?text=${text}${url}`, '_blank', 'noopener,noreferrer');
    }
  }

  if (loading) {
    return (
      <div className="panel pad-panel" style={{textAlign: 'center', padding: 60}}>
        Loading article…
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="panel pad-panel" style={{textAlign: 'center', padding: 48}}>
        <h2>Article not available</h2>
        <p className="muted">{error || 'This article has been moved or is no longer published.'}</p>
        <Link href="/announcements" className="btn btn-primary" style={{marginTop: 16, display: 'inline-block'}}>
          ← Return to News & Blog
        </Link>
      </div>
    );
  }

  const readTime = estimateReadTime(article.body || article.description);
  const pubDate = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'})
    : 'Official Announcement';

  return (
    <div style={{maxWidth: 820, margin: '0 auto', padding: '16px 0 60px'}}>
      {/* Back button */}
      <div style={{marginBottom: 24}}>
        <Link
          href="/announcements"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: '#103f2c',
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none'
          }}
        >
          <ArrowLeft size={16}/> Back to News & Blog
        </Link>
      </div>

      {/* Article Header */}
      <header style={{marginBottom: 32}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap'}}>
          <span
            style={{
              background: '#103f2c',
              color: '#fff',
              padding: '4px 12px',
              borderRadius: 14,
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            {article.category}
          </span>
          <span style={{fontSize: 13, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4}}>
            <Calendar size={13}/> {pubDate}
          </span>
          <span style={{fontSize: 13, color: 'var(--text-muted)'}}>·</span>
          <span style={{fontSize: 13, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4}}>
            <Clock size={13}/> {readTime}
          </span>
        </div>

        <h1 style={{fontSize: 34, fontWeight: 800, lineHeight: 1.25, color: '#103f2c', marginBottom: 16}}>
          {article.title}
        </h1>

        <p style={{fontSize: 18, lineHeight: 1.6, color: 'var(--text-muted)', fontWeight: 400}}>
          {article.description}
        </p>

        {/* Author & Share Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            padding: '14px 0',
            marginTop: 24
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: '#103f2c',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14
              }}
            >
              {(article.author || 'KASA')[0].toUpperCase()}
            </div>
            <div>
              <strong style={{display: 'block', fontSize: 14, color: 'var(--text-main)'}}>
                {article.author || 'KASA Communications'}
              </strong>
              <small className="muted" style={{fontSize: 12}}>
                Kamaila Academics, Sports & Apprenticeship
              </small>
            </div>
          </div>

          <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
            <button
              type="button"
              onClick={copyLink}
              className="btn btn-ghost"
              style={{display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 12px'}}
            >
              {copied ? <Check size={14} style={{color: '#2e7d32'}}/> : <Share2 size={14}/>}
              {copied ? 'Link copied!' : 'Copy link'}
            </button>
            <button
              type="button"
              onClick={shareWhatsApp}
              className="btn btn-outline"
              style={{display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 12px'}}
            >
              Share on WhatsApp
            </button>
          </div>
        </div>
      </header>

      {/* Article Body */}
      <main
        className="site-prose"
        style={{
          fontSize: 16,
          lineHeight: 1.8,
          color: 'var(--text-main)',
          marginBottom: 48,
          whiteSpace: 'pre-line'
        }}
      >
        {article.body}
      </main>

      {/* Call to Action Box */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(16,63,44,0.06), rgba(224,181,97,0.14))',
          border: '2px solid rgba(16,63,44,0.2)',
          borderRadius: 16,
          padding: 32,
          marginBottom: 48,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 16
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#103f2c',
            color: '#fff',
            padding: '4px 12px',
            borderRadius: 14,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase'
          }}
        >
          <Sparkles size={13}/> Join KASA 2027 Programmes
        </span>
        <h3 style={{fontSize: 22, fontWeight: 800, margin: 0, color: '#103f2c'}}>
          Ready to begin your training in Agriculture or Sports?
        </h3>
        <p style={{fontSize: 15, lineHeight: 1.6, color: 'var(--text-main)', margin: 0, maxWidth: 650}}>
          Applications are now open for both January and July 2027 intakes. If applying through Constituency Development Fund (CDF), applicants are automatically approved for their official offer pack.
        </p>
        <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4}}>
          <Link
            href="/apply/student-enrollment"
            className="btn btn-primary"
            style={{display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none'}}
          >
            Apply Online Now <ArrowRight size={16}/>
          </Link>
          <Link
            href="/programmes"
            className="btn btn-outline"
            style={{display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none'}}
          >
            View All Courses
          </Link>
        </div>
      </section>

      {/* Related Stories */}
      {related.length > 0 && (
        <section style={{borderTop: '1px solid var(--border)', paddingTop: 32}}>
          <h3 style={{fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#103f2c'}}>
            More from KASA News & Blog
          </h3>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16}}>
            {related.map(r => (
              <article
                key={r.id}
                style={{
                  background: 'var(--card-bg, #fff)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#103f2c',
                      display: 'block',
                      marginBottom: 6
                    }}
                  >
                    {r.category}
                  </span>
                  <h4 style={{fontSize: 15, fontWeight: 700, lineHeight: 1.35, margin: '0 0 8px'}}>
                    <Link href={`/announcements/${r.id}`} style={{color: 'inherit', textDecoration: 'none'}}>
                      {r.title}
                    </Link>
                  </h4>
                  <p style={{fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)', margin: 0}}>
                    {r.description.slice(0, 90)}…
                  </p>
                </div>
                <div style={{marginTop: 12}}>
                  <Link
                    href={`/announcements/${r.id}`}
                    style={{fontSize: 12, fontWeight: 700, color: '#103f2c', textDecoration: 'none'}}
                  >
                    Read story →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
