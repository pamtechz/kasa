'use client';

import {useState,useEffect,useRef,useCallback} from 'react';
import Link from 'next/link';
import type {LucideIcon} from 'lucide-react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Newspaper,
  Users,
  Coins,
  CheckCircle2,
  Sparkles,
  MapPin,Landmark,BriefcaseBusiness,Tractor,Wrench,Zap,Wheat,
  ScrollText,Banknote,Smartphone
} from 'lucide-react';
import type {SiteSettings} from '@/lib/site';

export type HeroSlide = {
  id: string;
  badge: string;
  titlePrefix: string;
  titleEmphasis: string;
  description: string;
  primaryCta: {
    label: string;
    href: string;
  };
  secondaryCta: {
    label: string;
    href: string;
  };
  tags: {label: string; href?: string; icon?: LucideIcon}[];
  metrics?: {value: string; label: string}[];
};

interface HeroSliderProps {
  site?: SiteSettings;
  agentHref?: string;
  studentHref?: string;
}

export function HeroSlider({
  site,
  agentHref = '/apply/agent-enrollment',
  studentHref = '/apply/kasa-enrollment-form'
}: HeroSliderProps) {
  const slides: HeroSlide[] = [
    {
      id: 'admissions',
      badge: site?.badge || '2027 RECRUITMENT & ADMISSIONS',
      titlePrefix: 'Opportunity begins in ',
      titleEmphasis: 'every district.',
      description:
        site?.heroDescription ||
        "Join KASA's district enrollment network. Help young people access practical training and understand the official CDF application process.",
      primaryCta: {
        label: 'Apply to be an agent',
        href: agentHref
      },
      secondaryCta: {
        label: 'Apply for training',
        href: studentHref
      },
      tags: [
        {label: '10 Provinces Coverage', icon: MapPin},
        {label: '116 Districts', icon: Landmark},
        {label: 'Verified Direct Commissions', icon: BriefcaseBusiness}
      ],
      metrics: site?.metrics
    },
    {
      id: 'courses',
      badge: 'FEATURED VOCATIONAL COURSES',
      titlePrefix: 'Hands-on training for ',
      titleEmphasis: 'market-ready careers.',
      description:
        'Equipping youth with accredited TEVETA Trade Testing certification across Heavy Equipment Operations, Automotive Engineering, Electrical Systems, and Commercial Agribusiness.',
      primaryCta: {
        label: 'Apply for enrollment',
        href: studentHref
      },
      secondaryCta: {
        label: 'Browse all courses',
        href: '/programmes'
      },
      tags: [
        {label: 'Heavy Equipment Operations', href: '/programmes', icon: Tractor},
        {label: 'Automotive Mechanics', href: '/programmes', icon: Wrench},
        {label: 'Electrical Systems', href: '/programmes', icon: Zap},
        {label: 'Commercial Agribusiness', href: '/programmes', icon: Wheat}
      ]
    },
    {
      id: 'news-cdf',
      badge: 'LATEST NEWS & CDF SPONSORSHIP',
      titlePrefix: 'Instant approval with ',
      titleEmphasis: 'CDF sponsorship.',
      description:
        'Selecting Constituency Development Fund (CDF) sponsorship automatically approves your admission and instantly generates an official editable PDF enrollment pack.',
      primaryCta: {
        label: 'Read news & guides',
        href: '/announcements'
      },
      secondaryCta: {
        label: 'Instant CDF application',
        href: studentHref
      },
      tags: [
        {label: '2027 Admissions Guide', href: '/announcements', icon: Newspaper},
        {label: 'Instant CDF Auto-Approval', href: '/announcements', icon: Zap},
        {label: 'Official Acceptance Packs', href: '/announcements', icon: ScrollText}
      ]
    },
    {
      id: 'referrals',
      badge: 'STUDENT REFERRAL & EARN PROGRAM',
      titlePrefix: 'Empower fellow youth, ',
      titleEmphasis: 'earn cash commissions.',
      description:
        'Students can participate directly in the KASA referral program to earn cash commissions for every peer they assist in securing approved enrollment across Zambia.',
      primaryCta: {
        label: 'Student referral portal',
        href: '/my-applications'
      },
      secondaryCta: {
        label: 'Apply as district agent',
        href: agentHref
      },
      tags: [
        {label: 'Earn Per Trainee Enrollment', icon: Banknote},
        {label: 'Live Mobile Status Tracking', icon: Smartphone},
        {label: 'Zero Initial Fee Required', icon: Sparkles}
      ]
    }
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const nextSlide = useCallback(() => {
    setActiveIndex(prev => (prev + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setActiveIndex(prev => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(nextSlide, 6500);
    return () => clearInterval(interval);
  }, [paused, nextSlide]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 45) {
      nextSlide();
    } else if (distance < -45) {
      prevSlide();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') prevSlide();
    if (e.key === 'ArrowRight') nextSlide();
  };

  const current = slides[activeIndex];

  return (
    <div
      className="hero-slider"
      role="region"
      aria-roledescription="carousel"
      aria-label="KASA Highlights and Announcements"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="hero-slide-content">
        <div className="hero-slider-badge" aria-label={`Category: ${current.badge}`}>
          <span className="pulse-dot" />
          <span>{current.badge}</span>
        </div>

        <h1 className="hero-slider-heading">
          {current.titlePrefix}
          <span className="hero-gold-text">{current.titleEmphasis}</span>
        </h1>

        <p className="hero-slider-description">{current.description}</p>

        <div className="hero-slider-actions">
          <Link href={current.primaryCta.href} className="btn-hero-white">
            {current.primaryCta.label} <ArrowRight size={18} />
          </Link>
          <Link href={current.secondaryCta.href} className="btn-hero-outline">
            {current.secondaryCta.label}
          </Link>
        </div>

        <div className="hero-slider-tags">
          {current.tags.map((tag, i) => {
            const Icon = tag.icon;
            return tag.href ? (
              <Link key={i} href={tag.href} className="hero-slider-tag-pill is-link">
                {Icon && <Icon size={16} strokeWidth={2} aria-hidden="true" className="tag-icon"/>}
                <span>{tag.label}</span>
                <ArrowRight size={12} className="tag-arrow" />
              </Link>
            ) : (
              <div key={i} className="hero-slider-tag-pill">
                {Icon && <Icon size={16} strokeWidth={2} aria-hidden="true" className="tag-icon"/>}
                <span>{tag.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hero-slider-controls">
        <div className="hero-slider-dots" role="tablist" aria-label="Slider pagination">
          {slides.map((s, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Go to slide ${index + 1}: ${s.badge}`}
                className={`hero-slider-dot ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveIndex(index)}
              >
                <span className="dot-label">{index + 1}</span>
              </button>
            );
          })}
        </div>

        <div className="hero-slider-nav-arrows">
          <button
            type="button"
            className="hero-slider-arrow"
            onClick={prevSlide}
            aria-label="Previous slide"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="hero-slider-arrow"
            onClick={nextSlide}
            aria-label="Next slide"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
