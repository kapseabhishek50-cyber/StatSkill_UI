import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { Card, Empty, ErrorNote, Loading } from '../../components/ui.jsx';
import { useApi, useMutation } from '../../hooks/useApi.js';
import { LEVEL_DESCRIPTORS, LEVEL_LABELS, api, endpoints, levelLabel } from '../../lib/index.js';

/**
 * Self-assessment against the officer's role requirements.
 *
 * A self-rating is evidence, not a level: it is stored with evidence
 * 'self_reported' and a confidence below what a quiz produces, so a later quiz
 * result overrides it. The interface says so rather than letting an officer
 * believe they have just certified themselves.
 */
export default function Assessment() {
  const items = useApi(endpoints.myRequirements);
  const mine = useApi(endpoints.myCompetencies);
  const profile = useApi(endpoints.profile);
  const location = useLocation();
  const prefill = location.state?.prefill ?? {};
  const [answers, setAnswers] = useState(prefill);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const submit = useMutation(async () => {
    const responses = required
      .map((entry) => {
        const competency = String(entry.competency?._id ?? entry.competency);
        const selfLevel = answers[competency] ?? recorded.get(competency) ?? extracted.get(competency)?.impliedLevel;
        return selfLevel === undefined ? null : { competency, selfLevel };
      })
      .filter(Boolean);
    const result = await api.post(endpoints.assessmentSubmit, { responses });
    setDone(true);
    return result;
  });

  const required = useMemo(() => items.data?.requirements ?? [], [items.data]);

  // Pre-fill from whatever is already recorded, so an officer revising one
  // competency does not have to re-rate the other twenty.
  const recorded = useMemo(() => {
    const map = new Map();
    for (const entry of mine.data?.competencies ?? []) {
      map.set(String(entry.competency?._id ?? entry.competency), entry.currentLevel);
    }
    return map;
  }, [mine.data]);

  const extracted = useMemo(() => {
    const map = new Map();
    for (const skill of profile.data?.profile?.extractedSkills ?? []) {
      const id = skill.competency?._id ?? skill.competency;
      if (id && skill.impliedLevel !== undefined) map.set(String(id), skill);
    }
    return map;
  }, [profile.data]);
  const answered = required.filter((entry) => {
    const id = String(entry.competency?._id ?? entry.competency);
    return answers[id] !== undefined || recorded.has(id) || extracted.has(id);
  }).length;

  if (items.loading || mine.loading || profile.loading) return <Loading label="Loading your role requirements" />;

  if (done) {
    return (
      <Card title="Assessment recorded">
        <div className="py-6 text-center">
          <CheckCircle2
            size={28}
            aria-hidden="true"
            className="mx-auto"
            style={{ color: 'var(--status-good)' }}
          />
          <p className="mt-3 text-sm text-ink">
            {answered} competenc{answered === 1 ? 'y' : 'ies'} recorded as self-reported.
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink-2">
            Your learning path has been recomputed against these levels. Clearing a quiz replaces a
            self-rating with an assessed level.
          </p>
          <button type="button" className="btn-primary mt-4" onClick={() => navigate('/path')}>
            See your learning path
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Self-assessment</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Rate yourself on the competencies your role requires. Pick the highest level you could
          demonstrate today without help — over-rating produces a path that skips what you need.
        </p>
      </div>

      <ErrorNote error={items.error ?? mine.error ?? profile.error ?? submit.error} onRetry={items.error ? items.refetch : mine.error ? mine.refetch : profile.refetch} />

      <div
        className="sticky top-[68px] z-10 flex items-center justify-between gap-4 rounded-card border border-hairline bg-surface px-4 py-3 shadow-card"
        role="status"
      >
        <p className="text-xs text-ink-2">
          <span className="tnum font-medium text-ink">{answered}</span> of{' '}
          <span className="tnum">{required.length}</span> rated
        </p>
        <button
          type="button"
          className="btn-primary"
          disabled={answered < required.length || submit.loading}
          onClick={() => submit.run()}
        >
          {submit.loading ? 'Recording…' : answered < required.length ? 'Rate all competencies' : 'Submit assessment'}
        </button>
      </div>

      {!required.length && <Empty>No role requirements found. Ask an administrator to set your job role.</Empty>}

      <div className="space-y-4">
        {required.map((entry) => {
          const id = String(entry.competency?._id ?? entry.competency);
          const resumeSuggestion = extracted.get(id);
          const chosen = answers[id] ?? recorded.get(id) ?? resumeSuggestion?.impliedLevel;
          return (
            <Card key={id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink">{entry.competency?.name}</h2>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {entry.competency?.category}
                    {entry.mandatory ? ' · mandatory for your role' : ''}
                  </p>
                </div>
                <p className="text-xs text-ink-2">
                  Role requires {levelLabel(entry.requiredLevel)}
                </p>
              </div>

              {entry.competency?.description && (
                <p className="mt-2 text-xs text-ink-2">{entry.competency.description}</p>
              )}

              <fieldset className="mt-3">
                <legend className="label mb-2">Your current level</legend>
                <div className="grid gap-1.5 sm:grid-cols-6">
                  {LEVEL_LABELS.map((label, level) => (
                    <label
                      key={level}
                      className={`cursor-pointer rounded-md border px-2 py-2 text-center text-xs transition-colors ${
                        chosen === level
                          ? 'border-transparent text-white'
                          : 'border-hairline text-ink-2 hover:bg-surface-2'
                      }`}
                      style={chosen === level ? { background: 'var(--series-1)' } : undefined}
                    >
                      <input
                        type="radio"
                        name={id}
                        value={level}
                        className="sr-only"
                        checked={chosen === level}
                        onChange={() => setAnswers({ ...answers, [id]: level })}
                      />
                      <span className="tnum block font-medium">{level}</span>
                      <span className="block">{label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 min-h-[2rem] text-xs text-ink-muted">
                  {chosen === undefined ? 'Choose a level to see what it means.' : LEVEL_DESCRIPTORS[chosen]}
                </p>
                {resumeSuggestion?.evidence && !recorded.has(id) && (
                  <p className="mt-1 text-[11px] italic text-ink-muted">Resume evidence: “{resumeSuggestion.evidence}”</p>
                )}
              </fieldset>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
