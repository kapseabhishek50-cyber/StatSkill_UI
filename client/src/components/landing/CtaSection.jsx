import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Reveal, Tilt3DCard } from '../fx/index.js';

/**
 * Closing call-to-action on a 3D panel: the card tilts with the pointer and
 * the buttons sit on a raised translateZ layer, so the whole block reads as
 * physical.
 */
export default function CtaSection() {
  const navigate = useNavigate();

  return (
    <section id="about" className="relative scroll-mt-24 pb-24 pt-10">
      <div className="mx-auto max-w-5xl px-6" style={{ perspective: '1400px' }}>
        <Reveal variant="flip-3d">
          <Tilt3DCard
            max={6}
            scale={1.0}
            className="relative overflow-hidden rounded-card-xl border border-hairline p-10 text-center sm:p-14"
            style={{
              background: 'linear-gradient(135deg, var(--navy) 0%, var(--navy-deep) 100%)',
            }}
          >
            <div className="bg-blueprint absolute inset-0 opacity-30" />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-pill border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                <ShieldCheck size={13} />
                Built for MoSPI · NSSTA · State Directorates
              </span>
              <h2 className="tilt-pop mt-6 text-hero-mobile sm:text-[2.3rem] font-bold tracking-tight text-white">
                Your next course is a derived number,
                <br className="hidden sm:inline" /> not a browsing session.
              </h2>
              <p className="tilt-pop mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-white/75">
                Sign in with a demo persona and see a live learning path computed from a real assessment — gaps,
                priorities, quizzes and all.
              </p>
              <div className="tilt-pop mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  onClick={() => navigate('/login')}
                  className="btn-sheen btn btn-primary !border-transparent !bg-white !text-navy w-full justify-center !px-6 sm:w-auto"
                >
                  Open the live demo <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="btn w-full justify-center !border-white/30 !bg-white/10 !text-white hover:!bg-white/20 !px-6 sm:w-auto"
                >
                  Create an account
                </button>
              </div>
            </div>
          </Tilt3DCard>
        </Reveal>
      </div>
    </section>
  );
}
