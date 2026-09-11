import { ArrowRight, RefreshCcw } from 'lucide-react';
import { Parallax, Reveal } from '../fx/index.js';

const CHAIN = [
  { label: 'Profile', detail: 'Cadre & division' },
  { label: 'Assessment', detail: 'Level measured' },
  { label: 'Gap', detail: 'Required − held' },
  { label: 'Path', detail: 'iGOT / NSSTA' },
  { label: 'Quiz', detail: 'Generated' },
  { label: 'Level updated', detail: 'Competency rewritten' },
];

/**
 * The system diagram as a living thing: the chain drifts on parallax at
 * alternating speeds so the loop reads as depth, and the return arrow
 * pulses to make the point — it feeds back.
 */
export default function LoopSection() {
  return (
    <section id="communities" className="relative scroll-mt-24 overflow-hidden py-20">
      <div className="aurora aurora-blue aurora-drift-slow left-[-8%] top-[10%] h-[26rem] w-[26rem]" />
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal variant="left">
            <span className="eyebrow">The loop</span>
            <h2 className="mt-4 text-hero-mobile sm:text-[2rem] font-bold tracking-tight text-ink">
              Learning that rewrites its own input.
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
              Most training portals end at &ldquo;course completed&rdquo;. StatSkill AI treats a passed quiz as new
              evidence: the recorded competency level changes, the gap engine reruns, and the platform&rsquo;s advice
              moves with it. The arrow back is the whole product.
            </p>
            <div className="mt-6 flex items-center gap-3 rounded-card-lg border border-hairline bg-surface p-4 shadow-card">
              <span className="icon-chip" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                <RefreshCcw size={15} strokeWidth={1.9} />
              </span>
              <p className="text-[13px] text-ink-2">
                <span className="font-semibold text-ink">Feedback loop:</span> Quiz → Evaluation → Competency updated →
                Assessment
              </p>
            </div>
          </Reveal>

          <div className="relative">
            <Parallax speed={0.1}>
              <Reveal variant="right">
                <div className="relative rounded-card-xl border border-hairline bg-surface p-6 shadow-card">
                  <div className="space-y-3">
                    {CHAIN.map((node, index) => (
                      <Parallax key={node.label} speed={0.06 + (index % 3) * 0.045}>
                        <div className="flex items-center gap-3">
                          <span
                            className="tnum grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                            style={{ background: index === CHAIN.length - 1 ? 'var(--status-good)' : 'var(--primary)' }}
                          >
                            {index + 1}
                          </span>
                          <div className="flex flex-1 items-center justify-between gap-3 rounded-button border border-hairline bg-plane px-4 py-2.5">
                            <span className="text-[13px] font-semibold text-ink">{node.label}</span>
                            <span className="text-[11px] text-ink-muted">{node.detail}</span>
                          </div>
                          {index < CHAIN.length - 1 ? (
                            <ArrowRight size={14} className="shrink-0 text-ink-muted" />
                          ) : (
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: 'var(--status-good)' }}>
                              <RefreshCcw size={11} className="text-white" />
                            </span>
                          )}
                        </div>
                      </Parallax>
                    ))}
                  </div>
                  <p className="mt-5 border-t border-hairline pt-4 text-center text-[12px] font-medium text-ink-muted">
                    The last node points at the first — pass a quiz and the path recomputes.
                  </p>
                </div>
              </Reveal>
            </Parallax>
          </div>
        </div>
      </div>
    </section>
  );
}
