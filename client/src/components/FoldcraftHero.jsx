import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  ArrowRight,
  Brain,
  TrendingUp,
  BarChart2,
  ShieldCheck,
  Landmark,
  Sparkles,
  ChevronDown,
  Zap,
  Activity,
} from 'lucide-react';
import { Hero3DScene, Reveal, ScrollProgress, Tilt3DCard, CountUp } from './fx/index.js';
import CompetencyMarquee from './landing/CompetencyMarquee.jsx';
import LiveStatsBand from './landing/LiveStatsBand.jsx';
import FeatureGrid from './landing/FeatureGrid.jsx';
import HowItWorks from './landing/HowItWorks.jsx';
import LoopSection from './landing/LoopSection.jsx';
import CtaSection from './landing/CtaSection.jsx';
import { fetchPublicStats } from '../lib/publicStats.js';
import { useScrolled, useScrollSpy } from '../hooks/useScrollFX.js';

const SECTION_IDS = ['home', 'explore', 'features', 'paths', 'communities', 'about'];

const NAV_LINKS = [
  { id: 'explore', label: 'Platform Pulse' },
  { id: 'features', label: 'Capabilities' },
  { id: 'paths', label: 'How It Works' },
  { id: 'communities', label: 'The Loop' },
  { id: 'about', label: 'About' },
];

/* Headline split into words so each can rise in 3D with its own delay. */
function RisingHeadline() {
  const lines = [
    { words: ['Turn', 'Skill', 'Gaps'], accent: false },
    { words: ['Into', 'Career', 'Growth.'], accent: true },
  ];
  let index = 0;
  return (
    <h1 className="word-rise text-hero-mobile sm:text-hero-desktop font-bold tracking-tight text-ink leading-[1.15]" style={{ perspective: '800px' }}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className="block">
          {line.words.map((word) => {
            index += 1;
            return (
              <span
                key={word}
                className={line.accent ? 'text-primary' : ''}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                {word}
                {'\u00A0'}
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

/* The 3D-tilted product card floating in the hero. */
function HeroDashboardCard({ live }) {
  const rows = [
    { name: 'Official Statistics', value: 82, tone: 'var(--status-good)', pill: 'pill-success', label: 'Advanced' },
    { name: 'Python & Data Analytics', value: 68, tone: 'var(--status-warning)', pill: 'pill-warning', label: 'Intermediate' },
    { name: 'AI / Machine Learning', value: 25, tone: 'var(--status-critical)', pill: 'pill-danger', label: 'High Gap' },
  ];

  return (
    <div className="relative" style={{ perspective: '1200px' }}>
      {/* Floating satellites — they live above the card on the Z axis and bob on their own clocks. */}
      <div className="float-y absolute -left-6 -top-6 z-10 sm:-left-10" style={{ transform: 'translateZ(50px)' }}>
        <div className="flex items-center gap-2 rounded-card-lg border border-hairline bg-surface px-3 py-2 shadow-card-hover">
          <span className="icon-chip !w-7 !h-7" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Zap size={13} strokeWidth={2} />
          </span>
          <div>
            <p className="text-[11px] font-bold text-ink">+120 XP</p>
            <p className="text-[10px] text-ink-muted">this week</p>
          </div>
        </div>
      </div>

      <div className="float-y-slow absolute -right-3 top-1/3 z-10 sm:-right-8" style={{ transform: 'translateZ(60px)' }}>
        <div className="flex items-center gap-2 rounded-card-lg border border-hairline bg-surface px-3 py-2 shadow-card-hover">
          <span className="icon-chip !w-7 !h-7" style={{ background: '#e8f7ee', color: 'var(--status-good)' }}>
            <TrendingUp size={13} strokeWidth={2} />
          </span>
          <div>
            <p className="text-[11px] font-bold text-ink">Gap closing</p>
            <p className="text-[10px] text-ink-muted">−18% this month</p>
          </div>
        </div>
      </div>

      <Reveal variant="rotate-3d" delay={250}>
        <Tilt3DCard max={8} scale={1.01} className="rounded-card-xl border border-hairline bg-surface p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between border-b border-hairline pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="icon-chip">
                <Brain size={16} strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="text-[13px] font-bold text-ink">Competency Radar</h3>
                <p className="text-[11px] text-ink-muted">Live AI Skill Profiling</p>
              </div>
            </div>
            <span className={`pill ${live ? 'pill-success' : 'pill-neutral'} text-[11px]`}>
              {live ? 'Live' : 'Demo'}
            </span>
          </div>

          {rows.map((row) => (
            <div key={row.name} className="rounded-button border border-hairline bg-plane p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">{row.name}</span>
                <span className={`pill ${row.pill} text-[10px]`}>{row.value}% {row.label}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${row.value}%`, background: row.tone }} />
              </div>
            </div>
          ))}

          <div className="border-t border-hairline pt-1.5 text-center">
            <span className="flex items-center justify-center gap-1.5 pt-2.5 text-xs text-ink-muted">
              <TrendingUp size={13} className="text-primary" />
              Target: 80% average role readiness
            </span>
          </div>
        </Tilt3DCard>
      </Reveal>

      {/* Supporting mini-cards, raised on the same 3D plane */}
      <Reveal variant="up" delay={400}>
        <div className="mx-auto mt-3 grid max-w-md grid-cols-2 gap-3">
          <Tilt3DCard max={12} className="card !p-3.5 flex items-center gap-2.5">
            <span className="icon-chip !w-8 !h-8"><BarChart2 size={15} strokeWidth={1.8} /></span>
            <div>
              <p className="text-xs font-bold text-ink">Gap Analytics</p>
              <p className="text-[11px] text-ink-muted">Priority scored</p>
            </div>
          </Tilt3DCard>
          <Tilt3DCard max={12} className="card !p-3.5 flex items-center gap-2.5">
            <span className="icon-chip !w-8 !h-8"><Sparkles size={15} strokeWidth={1.8} /></span>
            <div>
              <p className="text-xs font-bold text-ink">AI Pathways</p>
              <p className="text-[11px] text-ink-muted">Role-mapped</p>
            </div>
          </Tilt3DCard>
        </div>
      </Reveal>
    </div>
  );
}

export default function FoldcraftHero() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const scrolled = useScrolled(16);
  const active = useScrollSpy(SECTION_IDS);

  // Live platform numbers, refreshed on every visit and once a minute after.
  const [statsData, setStatsData] = useState(null);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, live: isLive } = await fetchPublicStats();
      if (cancelled) return;
      setStatsData(data);
      setLive(isLive);
      setUpdatedAt(new Date());
    }
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-x-clip bg-plane text-ink font-sans">
      <ScrollProgress />

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
          scrolled ? 'glass border-hairline shadow-card' : 'border-transparent bg-surface'
        }`}
      >
        <div className="w-full" style={{ background: 'var(--navy)' }}>
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-1">
            <Landmark size={12} className="text-white/80" />
            <p className="text-[11px] font-medium text-white/85">
              Competency intelligence for the Indian official statistical system · MoSPI / NSSTA
            </p>
          </div>
        </div>

        <div className={`mx-auto flex max-w-7xl items-center justify-between px-6 transition-all duration-300 ${scrolled ? 'py-2' : 'py-3'}`}>
          <a href="#home" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-button text-white font-bold text-[13px]" style={{ background: 'var(--navy)' }}>
              SS
            </span>
            <span className="text-[17px] font-bold tracking-tight text-ink">StatSkill AI</span>
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className={`relative text-[13px] font-medium transition-colors duration-200 ${
                  active === link.id ? 'text-primary' : 'text-ink-2 hover:text-primary'
                }`}
              >
                {link.label}
                <span
                  className="absolute -bottom-1.5 left-0 h-0.5 rounded-pill bg-primary transition-all duration-300"
                  style={{ width: active === link.id ? '100%' : '0%' }}
                />
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            <span className="mr-1 hidden items-center gap-1.5 rounded-pill border border-hairline bg-plane px-2.5 py-1 lg:flex">
              <span className={`live-dot ${live ? '' : 'live-dot-off'}`} />
              <span className="text-[10.5px] font-semibold text-ink-2">{live ? 'API live' : 'Demo data'}</span>
            </span>
            <button onClick={() => navigate('/login')} className="btn btn-quiet">
              Sign In
            </button>
            <button onClick={() => navigate('/register')} className="btn-sheen btn btn-primary">
              Get Started
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-ink-2 hover:text-ink md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="animate-slide-up space-y-4 border-t border-hairline bg-surface px-6 py-5 md:hidden">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm font-medium text-ink-2 hover:text-primary"
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2.5 pt-3">
              <button onClick={() => navigate('/login')} className="btn btn-quiet w-full justify-center">
                Sign In
              </button>
              <button onClick={() => navigate('/register')} className="btn btn-primary w-full justify-center">
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section id="home" className="relative scroll-mt-24 overflow-hidden">
        {/* Depth layers: WebGL scene, blueprint grid, aurora light */}
        <Hero3DScene />
        <div className="bg-blueprint pointer-events-none absolute inset-0" />
        <div className="aurora aurora-blue aurora-drift right-[-6%] top-[-8%] h-[30rem] w-[30rem]" />
        <div className="aurora aurora-ice aurora-drift-slow left-[-10%] bottom-[-20%] h-[26rem] w-[26rem]" />

        <main className="relative mx-auto max-w-7xl px-6 pb-20 pt-12 lg:pt-16">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="space-y-6 text-center lg:col-span-7 lg:text-left">
              <Reveal variant="down" duration={600}>
                <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  <span className="inline-flex items-center gap-2 rounded-pill border border-primary-border bg-primary-light px-3 py-1 text-xs font-semibold">
                    <ShieldCheck size={13} className="text-primary" />
                    <span className="text-primary">MoSPI &amp; NSSTA Framework Ready</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-2">
                    <span className={`live-dot ${live ? '' : 'live-dot-off'}`} />
                    {live ? 'Reading live platform data' : 'Showing demo snapshot'}
                  </span>
                </div>
              </Reveal>

              <RisingHeadline />

              <Reveal variant="up" delay={380}>
                <p className="mx-auto max-w-xl text-[15px] leading-relaxed text-ink-2 lg:mx-0">
                  Discover your strengths, identify competency gaps, and follow a personalized learning journey powered
                  by intelligent AI assessment.
                </p>
              </Reveal>

              <Reveal variant="up" delay={480}>
                <div className="flex flex-col items-center justify-center gap-3 pt-1 sm:flex-row lg:justify-start">
                  <button onClick={() => navigate('/login')} className="btn-sheen btn btn-primary !text-sm !px-5 !py-2.5 w-full sm:w-auto">
                    Start AI Assessment
                    <ArrowRight size={16} />
                  </button>
                  <a href="#explore" className="btn btn-quiet !text-sm !px-5 !py-2.5 w-full text-center sm:w-auto">
                    Explore the platform
                  </a>
                </div>
              </Reveal>

              {/* Trust indicators — the officer/competency/course numbers come from the API */}
              <Reveal variant="up" delay={580}>
                <div className="mx-auto grid max-w-md grid-cols-3 gap-6 border-t border-hairline pt-6 lg:mx-0">
                  <div>
                    <p className="tnum text-xl font-bold text-ink">
                      <CountUp end={statsData?.stats?.officers ?? 0} suffix="+" />
                    </p>
                    <p className="text-xs text-ink-muted">Officers seeded</p>
                  </div>
                  <div>
                    <p className="tnum text-xl font-bold text-ink">
                      <CountUp end={statsData?.stats?.competencies ?? 0} />
                    </p>
                    <p className="text-xs text-ink-muted">Competencies · 0–5 MoSPI scale</p>
                  </div>
                  <div>
                    <p className="tnum text-xl font-bold text-ink">
                      <CountUp end={statsData?.stats?.courses ?? 0} />
                    </p>
                    <p className="text-xs text-ink-muted">Courses · iGOT / NSSTA</p>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Right column: 3D dashboard */}
            <div className="lg:col-span-5">
              <HeroDashboardCard stats={statsData} live={live} />
            </div>
          </div>

          {/* Scroll cue */}
          <div className="mt-14 flex justify-center">
            <a href="#explore" aria-label="Scroll to content" className="scroll-nudge flex flex-col items-center gap-1 text-ink-muted hover:text-primary">
              <span className="text-[11px] font-semibold uppercase tracking-widest">Scroll</span>
              <ChevronDown size={18} />
            </a>
          </div>
        </main>
      </section>

      {/* ── Live sections ──────────────────────────────────────── */}
      <CompetencyMarquee competencies={statsData?.competencies ?? []} />
      <LiveStatsBand data={statsData} live={live} updatedAt={updatedAt} />
      <FeatureGrid />
      <HowItWorks />
      <LoopSection />
      <CtaSection />

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-hairline bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-5 sm:flex-row">
          <p className="text-xs text-ink-muted">StatSkill AI · Smart India Hackathon Prototype · MoSPI / NSSTA</p>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Activity size={12} />
            {live ? 'Serving live database numbers' : 'Offline demo snapshot'} · Secure · Role-based · Audit-logged
          </p>
        </div>
      </footer>
    </div>
  );
}
