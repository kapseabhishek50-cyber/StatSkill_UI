import { useState } from 'react';
import {
  BookOpen,
  ExternalLink,
  GraduationCap,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import CompetencyMeter from '../../components/CompetencyMeter.jsx';
import { Badge, Card, Empty, ErrorNote, Loading } from '../../components/ui.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api, endpoints } from '../../lib/index.js';

export default function LearningPath() {
  const path = useApi(endpoints.recommendations);
  const [recomputing, setRecomputing] = useState(false);

  if (path.loading) return <Loading label="Calculating optimal learning roadmap" />;
  if (path.error) return <ErrorNote error={path.error} onRetry={path.refetch} />;

  const data = path.data;
  const items = data?.path ?? [];

  async function handleRecompute() {
    setRecomputing(true);
    try {
      await api.post(endpoints.recomputeRecommendations, {});
      await path.refetch();
    } catch (err) {
      console.error('Failed to recompute path:', err);
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-ink">
            Personalized Learning Path
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-2">
            AI-sequenced curriculum based on your largest priority skill gaps.
          </p>
        </div>

        <button
          onClick={handleRecompute}
          disabled={recomputing}
          className="btn btn-primary !text-xs flex items-center gap-2 self-start sm:self-auto"
        >
          <Sparkles size={14} />
          {recomputing ? 'Recalculating...' : 'Recompute with AI'}
        </button>
      </div>

      {/* ── AI Narrative Explanation Card ──────────────────────── */}
      {data?.narrative && (
        <div className="card-ai p-5 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="icon-chip !w-7 !h-7">
              <Sparkles size={14} strokeWidth={1.8} />
            </span>
            <h2 className="text-xs font-bold tracking-wider text-primary uppercase">
              Curriculum Sequence Strategy
            </h2>
          </div>
          <p className="text-[13px] font-medium text-ink leading-relaxed">
            {data.narrative.summary}
          </p>
          {data.narrative.factors?.length > 0 && (
            <div className="pt-1.5 flex flex-wrap gap-2">
              {data.narrative.factors.map((f, i) => (
                <span key={i} className="pill pill-neutral text-[11px]">
                  <CheckCircle2 size={11} className="text-good" /> {f}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Visual Roadmap Timeline ─────────────────────────────── */}
      <div className="space-y-3.5">
        <h2 className="text-h2 font-bold text-ink">Curriculum Sequence</h2>

        <div className="space-y-3">
          {items.map((item, index) => {
            const isFirst = index === 0;
            return (
              <div
                key={item.competencyId}
                className={`card card-hover !p-5 transition-all duration-200 relative overflow-hidden ${
                  isFirst ? 'border-primary' : ''
                }`}
              >
                {isFirst && (
                  <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-button uppercase tracking-wider">
                    Next Focus Step
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Step Info */}
                  <div className="flex items-start gap-3.5 flex-1">
                    <span
                      className={`tnum grid h-9 w-9 shrink-0 place-items-center rounded-button font-bold text-[13px] ${
                        isFirst
                          ? 'bg-primary text-white'
                          : 'bg-plane border border-hairline text-ink-2'
                      }`}
                    >
                      0{index + 1}
                    </span>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[15px] font-bold text-ink">
                          {item.competency?.name}
                        </h3>
                        <Badge band={item.band} />
                      </div>
                      <p className="text-xs text-ink-2 max-w-xl leading-relaxed">
                        {item.explanation}
                      </p>
                    </div>
                  </div>

                  {/* Meter & Quick Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0">
                    <div className="w-44">
                      <CompetencyMeter
                        name="Target Level"
                        currentLevel={item.currentLevel}
                        requiredLevel={item.requiredLevel}
                        compact
                      />
                    </div>

                    <Link
                      to={`/quiz/${item.competencyId}`}
                      className="btn btn-primary !text-xs shrink-0"
                    >
                      <GraduationCap size={14} />
                      Take Quiz
                    </Link>
                  </div>
                </div>

                {/* Associated Courses List */}
                {item.courses?.length > 0 && (
                  <div className="mt-4 pt-3.5 border-t border-hairline">
                    <p className="label mb-2.5">
                      Recommended Course Materials
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {item.courses.map((c, cIdx) => (
                        <a
                          key={cIdx}
                          href={c.courseDetail?.externalUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-2.5 rounded-button bg-plane border border-hairline hover:border-primary-border hover:bg-primary-light transition-all duration-200 text-xs font-medium text-ink"
                        >
                          <span className="flex items-center gap-2 truncate">
                            <BookOpen size={13} className="text-primary shrink-0" />
                            <span className="truncate">{c.courseDetail?.title}</span>
                          </span>
                          <ExternalLink size={12} className="text-ink-muted shrink-0 ml-2" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {items.length === 0 && (
            <Card>
              <Empty
                title="No Learning Path Found"
                description="Complete your initial assessment so AI can chart your personal upskilling roadmap."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
