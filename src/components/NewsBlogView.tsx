'use client';

import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {
  Search, Calendar, Clock, User, ArrowRight, Sparkles,
  BookOpen, Award, Landmark, Users, Tag
} from 'lucide-react';
import type {Announcement} from '@/lib/content';

const categoryLabels: Record<string, {label: string; color: string; icon: any}> = {
  all: {label: 'All Stories', color: '#103f2c', icon: BookOpen},
  admissions: {label: 'Admissions & Intake', color: '#1b5e20', icon: Award},
  cdf: {label: 'CDF & Sponsorship', color: '#b78103', icon: Landmark},
  academic: {label: 'Agri-Sport & Training', color: '#00695c', icon: BookOpen},
  agents: {label: 'Referrals & Agents', color: '#0d47a1', icon: Users},
  general: {label: 'Campus Life & Updates', color: '#4a148c', icon: Tag}
};

function estimateReadTime(text: string): string {
  const words = text ? text.split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(words / 180));
  return `${minutes} min read`;
}

export function NewsBlogView() {
  const [articles, setArticles] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetch('/api/public/content?kind=announcements', {cache: 'no-store'})
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw Error(data.error || 'Failed to load announcements.');
        setArticles(data.items || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return articles.filter(a => {
      const matchCat = selectedCategory === 'all' || a.category === selectedCategory;
      const q = search.trim().toLowerCase();
      const matchQuery = !q || (
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        (a.body || '').toLowerCase().includes(q) ||
        (a.author || '').toLowerCase().includes(q)
      );
      return matchCat && matchQuery;
    });
  }, [articles, selectedCategory, search]);

  const featured = useMemo(() => {
    if (!articles.length) return null;
    return articles.find(a => a.pinned) || articles[0];
  }, [articles]);

  const remaining = useMemo(() => {
    if (!featured) return filtered;
    return filtered.filter(a => a.id !== featured.id);
  }, [filtered, featured]);

  return (
    <div className="news-blog-container">
      {/* Search & Categories Bar */}
      <div className="news-toolbar" style={{marginBottom: 32}}>
        <div style={{display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between'}}>
          {/* Categories Pill Navigation */}
          <div className="news-categories" style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
            {Object.entries(categoryLabels).map(([catKey, cat]) => {
              const active = selectedCategory === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setSelectedCategory(catKey)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 24,
                    border: active ? '1px solid ' + cat.color : '1px solid var(--border)',
                    background: active ? cat.color : 'var(--card-bg, #fff)',
                    color: active ? '#fff' : 'var(--text-main)',
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <cat.icon size={14}/>
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div style={{position: 'relative', minWidth: 260, flex: '1 1 260px', maxWidth: 360}}>
            <Search size={16} style={{position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)'}}/>
            <input
              type="search"
              placeholder="Search news, topics, keywords…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 24,
                border: '1px solid var(--border)',
                background: 'var(--card-bg, #fff)',
                fontSize: 13
              }}
            />
          </div>
        </div>
      </div>

      {loading && <div className="panel pad-panel" style={{textAlign: 'center', padding: 48}}>Loading stories…</div>}
      {error && <div className="alert-error" style={{marginBottom: 20}}>{error}</div>}

      {!loading && !articles.length && (
        <div className="panel pad-panel" style={{textAlign: 'center', padding: 48}}>
          <BookOpen size={40} style={{color: 'var(--text-muted)', marginBottom: 12}}/>
          <h3>No articles published yet</h3>
          <p className="muted">KASA communications will publish official news, updates and guides here.</p>
        </div>
      )}

      {/* FEATURED STORY (Shown when on "all" and not filtering heavily) */}
      {!loading && featured && selectedCategory === 'all' && !search && (
        <article
          className="featured-news-card"
          style={{
            background: 'linear-gradient(135deg, rgba(16,63,44,0.06), rgba(224,181,97,0.12))',
            border: '2px solid rgba(16,63,44,0.2)',
            borderRadius: 16,
            padding: '32px 36px',
            marginBottom: 40,
            position: 'relative',
            boxShadow: '0 8px 24px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14}}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#103f2c',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: 14,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}
            >
              <Sparkles size={13}/> Featured Story
            </span>
            <span
              style={{
                background: 'rgba(16,63,44,0.1)',
                color: '#103f2c',
                padding: '4px 10px',
                borderRadius: 14,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase'
              }}
            >
              {categoryLabels[featured.category]?.label || featured.category}
            </span>
            <span style={{fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4}}>
              <Clock size={12}/> {estimateReadTime(featured.body || featured.description)}
            </span>
          </div>

          <h2 style={{fontSize: 26, fontWeight: 800, color: '#103f2c', marginBottom: 12, lineHeight: 1.3}}>
            <Link href={`/announcements/${featured.id}`} style={{color: 'inherit', textDecoration: 'none'}}>
              {featured.title}
            </Link>
          </h2>

          <p style={{fontSize: 16, lineHeight: 1.6, color: 'var(--text-main)', marginBottom: 20, maxWidth: 840}}>
            {featured.description}
          </p>

          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)'}}>
              <span style={{display: 'inline-flex', padding: 6, borderRadius: '50%', background: '#e8f5e9', color: '#103f2c'}}>
                <User size={14}/>
              </span>
              <span>By <strong>{featured.author || 'KASA Communications'}</strong></span>
              <span>·</span>
              <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}>
                <Calendar size={13}/> {featured.publishedAt ? new Date(featured.publishedAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'}) : 'Latest Update'}
              </span>
            </div>

            <Link
              href={`/announcements/${featured.id}`}
              className="btn btn-primary"
              style={{display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none'}}
            >
              Read full story <ArrowRight size={16}/>
            </Link>
          </div>
        </article>
      )}

      {/* ARTICLES GRID */}
      {!loading && (
        <>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18}}>
            <h3 style={{margin: 0, fontSize: 18, fontWeight: 700}}>
              {selectedCategory === 'all' && !search ? 'Latest Articles & Updates' : `Matching Articles (${filtered.length})`}
            </h3>
            {search && (
              <button
                type="button"
                className="text-link"
                onClick={() => {setSearch(''); setSelectedCategory('all');}}
                style={{fontSize: 13}}
              >
                Clear filters
              </button>
            )}
          </div>

          {!filtered.length ? (
            <div className="panel pad-panel" style={{textAlign: 'center', padding: 32}}>
              <p>No stories found matching your filter criteria.</p>
              <button type="button" className="btn btn-outline" onClick={() => {setSearch(''); setSelectedCategory('all');}}>
                Reset filters
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 22
              }}
            >
              {(selectedCategory === 'all' && !search ? remaining : filtered).map(article => {
                const cat = categoryLabels[article.category] || categoryLabels.general;
                const readTime = estimateReadTime(article.body || article.description);
                return (
                  <article
                    key={article.id}
                    className="news-card"
                    style={{
                      background: 'var(--card-bg, #fff)',
                      border: '1px solid var(--border)',
                      borderRadius: 14,
                      padding: 24,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.03)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                  >
                    <div>
                      {/* Category & Read Time */}
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
                        <span
                          style={{
                            background: cat.color + '15',
                            color: cat.color,
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.03em',
                            textTransform: 'uppercase'
                          }}
                        >
                          {cat.label}
                        </span>
                        <span style={{fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3}}>
                          <Clock size={11}/> {readTime}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 style={{fontSize: 18, fontWeight: 700, lineHeight: 1.35, marginBottom: 10, color: 'var(--text-main)'}}>
                        <Link href={`/announcements/${article.id}`} style={{color: 'inherit', textDecoration: 'none'}}>
                          {article.title}
                        </Link>
                      </h3>

                      {/* Excerpt */}
                      <p style={{fontSize: 14, lineHeight: 1.55, color: 'var(--text-muted)', marginBottom: 16}}>
                        {article.description}
                      </p>
                    </div>

                    {/* Footer Byline & Read Link */}
                    <div style={{borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                      <div style={{fontSize: 12, color: 'var(--text-muted)'}}>
                        <span>{article.author || 'KASA Team'}</span>
                        <span style={{margin: '0 4px'}}>·</span>
                        <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'}) : '2026'}</span>
                      </div>

                      <Link
                        href={`/announcements/${article.id}`}
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#103f2c',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        Read <ArrowRight size={13}/>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
