import { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Play,
  Search,
} from 'lucide-react';
import { useApi } from '../../hooks/useApi.js';
import { endpoints } from '../../lib/index.js';
import { Card, Empty, ErrorNote, Loading, StatTile } from '../../components/ui.jsx';

export default function MyLearning() {
  const learning = useApi(endpoints.myLearning);
  const [filter, setFilter] = useState('all'); // all | in_progress | completed
  const [search, setSearch] = useState('');

  if (learning.loading) return <Loading label="Loading your courses" />;
  if (learning.error) return <ErrorNote error={learning.error} onRetry={learning.refetch} />;

  const stats = learning.data?.stats ?? { total: 0, completed: 0, inProgress: 0, totalHours: 0 };
  const enrollments = learning.data?.enrollments ?? [];

  const filtered = enrollments.filter((item) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'completed' && item.status === 'completed') ||
      (filter === 'in_progress' && item.status === 'in_progress');
    const matchesSearch =
      !search ||
      item.course?.title?.toLowerCase().includes(search.toLowerCase()) ||
      item.course?.provider?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-h1 font-bold tracking-tight text-ink">My Courses</h1>
          <p className="mt-0.5 text-[13px] text-ink-2">
            Track your progress, access video materials, and complete certifications.
          </p>
        </div>
      </div>

      {/* ── Stat Tiles ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Enrolled Courses"
          value={stats.total}
          hint="From official NSSTA & iGOT"
          icon={BookOpen}
        />
        <StatTile
          label="Completed"
          value={stats.completed}
          delta={stats.completed > 0 ? 'Certified' : null}
          icon={CheckCircle2}
        />
        <StatTile
          label="In Progress"
          value={stats.inProgress}
          hint="Active curriculum modules"
          icon={Play}
        />
        <StatTile
          label="Learning Time"
          value={`${stats.totalHours}h`}
          hint="Total contact hours logged"
          icon={Clock}
        />
      </div>

      {/* ── Filters & Search ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center border-b border-hairline pb-3.5">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {['all', 'in_progress', 'completed'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold capitalize transition-all duration-200 ${
                filter === tab
                  ? 'bg-primary text-white'
                  : 'bg-surface-2 text-ink-2 hover:text-ink border border-transparent hover:border-hairline'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Search enrolled courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface border border-hairline rounded-button py-2 pl-10 pr-4 text-xs text-ink placeholder:text-ink-muted focus:border-primary outline-none transition-all duration-200"
          />
        </div>
      </div>

      {/* ── Course Grid ───────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div key={item._id} className="course-card group flex flex-col justify-between">
              <div>
                <div className="relative h-36 w-full overflow-hidden bg-surface-3">
                  <img
                    src={
                      item.course?.imageUrl ||
                      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800&auto=format&fit=crop'
                    }
                    alt={item.course?.title}
                    className="course-card-image h-full w-full object-cover"
                  />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,59,120,0) 40%, rgba(6,59,120,0.55) 100%)' }} />
                  <span
                    className={`absolute top-2.5 left-2.5 pill text-[10px] ${
                      item.status === 'completed' ? 'pill-success !bg-white' : 'pill-ai'
                    }`}
                  >
                    {item.status === 'completed' ? 'Completed' : 'In Progress'}
                  </span>
                  <span className="absolute bottom-2.5 right-3 text-[11px] font-medium text-white/90">
                    {item.course?.durationHours || 4}h duration
                  </span>
                </div>

                <div className="p-4 space-y-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {item.course?.provider || 'iGOT Karmayogi'}
                  </span>
                  <h3 className="text-[14px] font-bold text-ink group-hover:text-primary transition-colors duration-200 leading-snug">
                    {item.course?.title}
                  </h3>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs text-ink-2 font-medium">
                      <span>Course Progress</span>
                      <span className="tnum font-bold text-ink">{item.progressPct || 0}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${item.progressPct || 0}%`,
                          background: item.status === 'completed' ? 'var(--status-good)' : 'var(--primary)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-3 flex items-center justify-between gap-3 border-t border-hairline mt-1">
                <a
                  href={item.course?.externalUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-quiet !text-xs flex-1 justify-center"
                >
                  <ExternalLink size={13} />
                  Launch Course
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            title="No Courses Found"
            description="Explore your personalized Learning Path to discover and enroll in new courses."
          />
        </Card>
      )}
    </div>
  );
}
