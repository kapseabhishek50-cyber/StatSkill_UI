import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, ArrowRight, ShieldCheck } from 'lucide-react';
import { Reveal, Tilt3DCard } from '../components/fx/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorNote, Loading, ThemeToggle } from '../components/ui.jsx';

/**
 * Demo personas are printed here so a judge can sign in without a slip of paper.
 * These are seeded throwaway accounts — remove before going real.
 */
const PERSONAS = [
  {
    email: 'rahul.sharma@mospi.gov.in',
    password: 'Officer@123',
    role: 'Statistical Officer · SDRD',
    label: 'Rahul Sharma',
    detail: '7-day streak · AI/ML gap · personalized iGOT pathway',
    tag: 'Learner',
  },
  {
    email: 'trainer@nssta.gov.in',
    password: 'Trainer@123',
    role: 'NSSTA Faculty',
    label: 'Prof. S. Mukherjee',
    detail: 'Curriculum uploads · AI quiz generator · cohort analytics',
    tag: 'Trainer',
  },
  {
    email: 'admin@mospi.gov.in',
    password: 'Admin@123',
    role: 'MoSPI Training Admin',
    label: 'Dr. Vikram Iyer',
    detail: 'Skill heatmaps · workforce readiness · governance',
    tag: 'Admin',
  },
];

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4';

export default function Login() {
  const { user, status, signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (status === 'loading') return <Loading label="Checking your session" />;
  if (user) return <Navigate to={location.state?.from ?? '/'} replace />;

  async function handleLoginWithCredentials(email, password) {
    setBusy(true);
    setError(null);
    try {
      const signedIn = await signIn(email.trim(), password);
      const target =
        signedIn.role === 'admin'
          ? '/admin'
          : signedIn.role === 'trainer'
            ? '/trainer'
            : '/';
      navigate(target, { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    await handleLoginWithCredentials(form.email, form.password);
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* ── Left panel: branded navy overlay over video ── */}
      <div className="relative hidden overflow-hidden md:flex md:flex-col md:justify-between" style={{ background: 'var(--navy)' }}>
        {/* Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '70% center' }}
          src={VIDEO_SRC}
        />

        {/* Navy overlay for legibility + brand */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(6,59,120,0.92) 0%, rgba(5,46,96,0.78) 55%, rgba(5,46,96,0.6) 100%)' }} />

        {/* Content on top of video */}
        <div className="relative z-10 flex flex-col justify-between h-full p-10">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2.5 rounded-button bg-white px-3 py-2">
              <span
                className="grid h-7 w-7 place-items-center rounded-md text-[11px] font-bold text-white"
                style={{ background: 'var(--navy)' }}
                aria-hidden="true"
              >
                SS
              </span>
              <div className="leading-tight">
                <p className="text-[13px] font-bold" style={{ color: 'var(--navy)' }}>StatSkill AI</p>
                <p className="text-[10px] font-medium text-ink-muted">MoSPI · NSO · State DES</p>
              </div>
            </div>
          </div>

          {/* Hero copy */}
          <div className="max-w-md">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/60">
              <ShieldCheck size={13} />
              AI Competency Intelligence
            </p>
            <h1 className="text-[26px] font-bold leading-[1.25] tracking-tight text-white">
              Competency-based upskilling for the official statistical system
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-white/70">
              Every officer&apos;s path is computed from the gap between the level
              their role requires and the level their record shows — on a fixed
              0–5 scale, with the arithmetic visible rather than asserted.
            </p>

            <div className="mt-7 space-y-2.5">
              {[
                'Profile & self-assessment establish current levels',
                'Role requirements define the target',
                'Gap × importance → priority score',
                'Courses matched to gap; quiz records new level',
              ].map((step, i) => (
                <div key={step} className="flex items-start gap-2.5">
                  <span className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-[13px] text-white/75">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-[11px] text-white/40">
            Smart India Hackathon Prototype · MoSPI / NSSTA
          </p>
        </div>
      </div>

      {/* ── Right panel: Sign-in form ── */}
      <div className="flex flex-col justify-center bg-plane p-6 sm:p-10">
        <div className="mx-auto w-full max-w-sm">
          <Link
            to="/foldcraft"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-primary"
          >
            <ArrowRight size={12} className="rotate-180" />
            Back to the website
          </Link>

          {/* Mobile brand */}
          <div className="md:hidden mb-6 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-button text-white font-bold text-[13px]" style={{ background: 'var(--navy)' }}>
              SS
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-bold text-ink">StatSkill AI</p>
              <p className="text-[11px] text-ink-muted">MoSPI · NSO · State DES</p>
            </div>
          </div>

          <Reveal variant="flip-3d" duration={650}>
          <Tilt3DCard max={4} scale={1.005} className="card !p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-[19px] font-bold tracking-tight text-ink">
                  Welcome back
                </h2>
                <p className="mt-0.5 text-[13px] text-ink-muted">Sign in to continue</p>
              </div>
              <ThemeToggle />
            </div>

            <form onSubmit={submit} className="space-y-3.5">
              <div>
                <label htmlFor="email" className="label">
                  Official email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="name@mospi.gov.in"
                  className="field mt-1.5"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  className="field mt-1.5"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>

              <ErrorNote error={error} />

              <button
                type="submit"
                className="btn btn-primary w-full gap-2 !py-2.5"
                disabled={busy}
              >
                <LogIn size={15} aria-hidden="true" />
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-ink-2">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-semibold text-primary hover:underline">
                Register
              </Link>
            </p>
          </Tilt3DCard>
          </Reveal>

          {/* Demo personas */}
          <Reveal variant="up" delay={140} className="mt-4">
          <div className="card !p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="label">Evaluation Demo Personas</p>
              <span className="flex items-center gap-1 text-[10px] font-medium text-ink-muted">
                <ArrowRight size={10} />
                1-click sign-in
              </span>
            </div>
            <ul className="space-y-2">
              {PERSONAS.map((persona) => (
                <li
                  key={persona.email}
                  className="rounded-button border border-hairline bg-plane p-2.5 transition-all duration-200 hover:border-primary-border hover:bg-primary-light"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-ink">{persona.label}</p>
                        <span className="pill pill-neutral !text-[10px] !py-0">
                          {persona.tag}
                        </span>
                      </div>
                      <p className="tnum text-[10px] font-semibold text-primary">{persona.role}</p>
                      <p className="mt-0.5 truncate text-[11px] text-ink-muted">{persona.detail}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      className="btn btn-primary !text-[11px] !px-2.5 !py-1 shrink-0"
                      onClick={() =>
                        handleLoginWithCredentials(persona.email, persona.password)
                      }
                    >
                      Sign in
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
