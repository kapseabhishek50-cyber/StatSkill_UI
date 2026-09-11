import { useEffect, useRef } from 'react';
import { UserSearch, Target, Route as RouteIcon, RefreshCcw } from 'lucide-react';
import { Reveal } from '../fx/index.js';

const STEPS = [
  {
    icon: UserSearch,
    step: '01',
    title: 'Assess',
    body: 'A short adaptive assessment records the officer’s current level on the MoSPI 0–5 scale. No self-reporting — measured, not claimed.',
  },
  {
    icon: Target,
    step: '02',
    title: 'Compare with the role',
    body: 'The platform reads the level the officer’s cadre and division require, and derives the gap and its priority band from the two numbers.',
  },
  {
    icon: RouteIcon,
    step: '03',
    title: 'Learn the gap',
    body: 'A computed path pulls matching courses from iGOT Karmayogi, NSSTA and the internal catalogue — then a generated quiz closes the loop.',
  },
  {
    icon: RefreshCcw,
    step: '04',
    title: 'Re-measure',
    body: 'A quiz pass updates the recorded competency level. The gap shrinks, the path recomputes, and the next recommendation is already different.',
  },
];

/**
 * Scroll-driven timeline: the rail fills as the section travels through the
 * viewport, and each step flips into place in 3D as it arrives.
 */
export default function HowItWorks() {
  const railRef = useRef(null);
  const sectionRef = useRef(null);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const section = sectionRef.current;
      const rail = railRef.current;
      if (!section || !rail) return;
      const rect = section.getBoundingClientRect();
      const viewport = window.innerHeight;
      // 0 when the section top reaches 80% of the viewport, 1 when its bottom passes 35%.
      const total = rect.height + viewport * 0.45;
      const travelled = viewport * 0.8 - rect.top;
      const fraction = Math.min(1, Math.max(0, travelled / total));
      rail.style.setProperty('--tl-progress', fraction.toFixed(3));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="paths" className="relative scroll-mt-24 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-4 text-hero-mobile sm:text-[2rem] font-bold tracking-tight text-ink">
            From &ldquo;what level am I?&rdquo; to &ldquo;what do I learn next?&rdquo;
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Four steps — and the fourth one feeds the first. Scroll and watch the path fill.
          </p>
        </Reveal>

        <div ref={sectionRef} className="relative mx-auto mt-14 max-w-3xl">
          <div className="timeline-rail">
            <div ref={railRef} className="timeline-progress" />
          </div>

          <ol className="space-y-10">
            {STEPS.map((item, index) => (
              <li key={item.step} className="relative">
                <Reveal variant="flip-3d" delay={60}>
                  <div className="flex items-start gap-5 sm:gap-6">
                    <span
                      className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-surface font-bold text-primary shadow-card"
                      style={{ borderColor: 'var(--primary-border)' }}
                    >
                      <item.icon size={16} strokeWidth={1.9} />
                    </span>
                    <div className="flex-1 rounded-card-lg border border-hairline bg-surface p-5 shadow-card">
                      <div className="flex items-center gap-2.5">
                        <span className="tnum text-[11px] font-bold tracking-widest text-ink-muted">{item.step}</span>
                        <h3 className="text-[15px] font-bold tracking-tight text-ink">{item.title}</h3>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{item.body}</p>
                    </div>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
