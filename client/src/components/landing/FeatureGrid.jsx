import { Brain, Route as RouteIcon, BarChart2, ShieldCheck, MessageSquare, Trophy } from 'lucide-react';
import { Reveal, Tilt3DCard } from '../fx/index.js';

const FEATURES = [
  {
    icon: Brain,
    title: 'AI-generated assessments',
    body: 'Quizzes are generated against the exact competency and target level — not pulled from a static bank.',
    accent: 'var(--primary)',
  },
  {
    icon: RouteIcon,
    title: 'Computed learning paths',
    body: 'Role requirement minus current level equals the gap; the gap, priority and courses all follow from that arithmetic.',
    accent: 'var(--primary-bright)',
  },
  {
    icon: BarChart2,
    title: 'Workforce heatmaps',
    body: 'Division × competency readiness on one screen, with ranked gaps that tell administrators where to spend training hours.',
    accent: 'var(--navy)',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based & audit-logged',
    body: 'Officer, trainer and admin views are enforced on every API call, and consequential actions land in an audit log.',
    accent: 'var(--status-good)',
  },
  {
    icon: MessageSquare,
    title: 'Learning communities',
    body: 'Realtime discussion groups per competency, so an officer stuck on sampling design can ask the officer who isn’t.',
    accent: 'var(--status-warning)',
  },
  {
    icon: Trophy,
    title: 'Streaks & XP that mean something',
    body: 'Gamification is wired to learning events — quiz passes and course completions, not raw logins.',
    accent: 'var(--streak)',
  },
];

export default function FeatureGrid() {
  return (
    <section id="features" className="relative scroll-mt-24 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="max-w-2xl">
          <span className="eyebrow">What&rsquo;s inside</span>
          <h2 className="mt-4 text-hero-mobile sm:text-[2rem] font-bold tracking-tight text-ink">
            A loop, not a funnel.
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            A quiz pass rewrites the officer&rsquo;s recorded level, which changes the gap, which changes the next
            recommendation. Every part of the platform feeds back into the first step.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" style={{ perspective: '1400px' }}>
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} variant="flip-3d" delay={(index % 3) * 110}>
              <Tilt3DCard
                max={10}
                className="group h-full rounded-card-lg border border-hairline bg-surface p-6 shadow-card"
              >
                <span
                  className="icon-chip !w-11 !h-11"
                  style={{ background: 'var(--primary-light)', color: feature.accent }}
                >
                  <feature.icon size={20} strokeWidth={1.8} />
                </span>
                <h3 className="tilt-pop-sm mt-5 text-[15.5px] font-bold tracking-tight text-ink">{feature.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{feature.body}</p>
                <div
                  className="mt-5 h-0.5 w-10 rounded-pill transition-all duration-300 group-hover:w-16"
                  style={{ background: feature.accent }}
                />
              </Tilt3DCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
