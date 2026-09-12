import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, Empty, ErrorNote, Loading } from '../../components/ui.jsx';
import { useApi, useMutation } from '../../hooks/useApi.js';
import { api, endpoints } from '../../lib/index.js';

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const PROVIDERS = ['NSSTA', 'iGOT Karmayogi', 'MoSPI', 'INTERNAL'];

export default function Courses() {
  const [provider, setProvider] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentCourse, setCurrentCourse] = useState(null);
  const [skillCodes, setSkillCodes] = useState([]);

  const { data, loading, error, refetch } = useApi(endpoints.adminCourses);
  const competenciesQuery = useApi(endpoints.competencies);

  const saveCourse = useMutation(async (courseData) => {
    if (currentCourse?._id) {
      await api.patch(`${endpoints.adminCourses.split('?')[0]}/${currentCourse._id}`, courseData);
    } else {
      await api.post(endpoints.adminCourses.split('?')[0], courseData);
    }
  });

  const toggleStatus = useMutation(async (courseId, isActive) => {
    if (isActive) {
      await api.del(`${endpoints.adminCourses.split('?')[0]}/${courseId}`);
    } else {
      await api.patch(`${endpoints.adminCourses.split('?')[0]}/${courseId}`, { isActive: true });
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      title: formData.get('title'),
      provider: formData.get('provider'),
      category: formData.get('category'),
      level: formData.get('level'),
      url: formData.get('url') || undefined,
      description: formData.get('description'),
      durationHours: Number(formData.get('durationHours')) || 4,
      tags: String(formData.get('tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean),
      rating: Number(formData.get('rating')) || 4,
      skills: skillCodes,
    };

    try {
      await saveCourse.run(payload);
      setIsEditing(false);
      setCurrentCourse(null);
      setSkillCodes([]);
      refetch();
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleEdit = (course) => {
    setCurrentCourse(course);
    setSkillCodes([...(course.skills ?? [])]);
    setIsEditing(true);
  };

  const handleToggleStatus = async (course) => {
    try {
      await toggleStatus.run(course._id, course.isActive ?? true);
      refetch();
    } catch (err) {
      // Error handled by hook
    }
  };

  const allCourses = useMemo(() => data?.items ?? data?.courses ?? [], [data]);
  const courses = useMemo(
    () => (provider ? allCourses.filter((c) => c.provider === provider) : allCourses),
    [allCourses, provider],
  );
  const providerOptions = useMemo(
    () => [...new Set([...PROVIDERS, ...allCourses.map((c) => c.provider).filter(Boolean)])],
    [allCourses],
  );
  const competencyOptions = useMemo(
    () => competenciesQuery.data?.competencies ?? [],
    [competenciesQuery.data],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Course catalog</h1>
          <p className="mt-1 text-sm text-ink-2">Manage available learning resources and their skill mappings.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setCurrentCourse(null);
            setSkillCodes([]);
            setIsEditing(true);
          }}
        >
          <Plus size={16} aria-hidden="true" />
          Add course
        </button>
      </div>

      {!isEditing && (
        <div className="flex flex-wrap items-end gap-3 rounded-card border border-hairline bg-surface px-4 py-3">
          <div>
            <label htmlFor="provider" className="label">Provider</label>
            <select
              id="provider"
              className="field mt-1 w-64"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="">All providers</option>
              {providerOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <ErrorNote
        error={error || competenciesQuery.error || saveCourse.error || toggleStatus.error}
        onRetry={error ? refetch : competenciesQuery.refetch}
      />

      {isEditing ? (
        <Card title={currentCourse ? 'Edit course' : 'New course'} className="max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Title</label>
                <input required name="title" className="field mt-1 w-full" defaultValue={currentCourse?.title} />
              </div>
              <div>
                <label className="label">Provider</label>
                <select required name="provider" className="field mt-1 w-full" defaultValue={currentCourse?.provider || 'NSSTA'}>
                  {providerOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Category</label>
                <input required name="category" className="field mt-1 w-full" defaultValue={currentCourse?.category} placeholder="e.g. Statistical Methods" />
              </div>
              <div>
                <label className="label">URL</label>
                <input type="url" name="url" className="field mt-1 w-full" defaultValue={currentCourse?.url} placeholder="https://..." />
              </div>
              <div>
                <label className="label">Duration (hours)</label>
                <input type="number" step="0.5" min="0" name="durationHours" className="field mt-1 w-full" defaultValue={currentCourse?.durationHours || 4} />
              </div>
              <div>
                <label className="label">Level</label>
                <select name="level" className="field mt-1 w-full" defaultValue={currentCourse?.level || 'BEGINNER'}>
                  {LEVELS.map((level) => (
                    <option key={level} value={level}>{level.charAt(0) + level.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Rating (0-5)</label>
                <input type="number" min="0" max="5" step="0.1" name="rating" className="field mt-1 w-full" defaultValue={currentCourse?.rating ?? 4.0} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Tags (comma-separated)</label>
                <input name="tags" className="field mt-1 w-full" defaultValue={currentCourse?.tags?.join(', ')} placeholder="sampling, estimation" />
              </div>
            </div>

            <div>
              <label className="label">Description (min 10 characters)</label>
              <textarea required minLength={10} name="description" rows="3" className="field mt-1 w-full" defaultValue={currentCourse?.description}></textarea>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="label">Skill mappings (competency codes)</label>
                <span className="text-[11px] text-ink-muted">{skillCodes.length} mapped</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {competencyOptions.map((competency) => {
                  const active = skillCodes.includes(competency.code);
                  return (
                    <button
                      key={competency._id}
                      type="button"
                      title={competency.name}
                      onClick={() =>
                        setSkillCodes((current) =>
                          active ? current.filter((code) => code !== competency.code) : [...current, competency.code],
                        )
                      }
                      className={`rounded-pill border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        active
                          ? 'border-primary bg-primary text-white'
                          : 'border-hairline bg-plane text-ink-2 hover:border-primary-border'
                      }`}
                    >
                      {competency.code}
                    </button>
                  );
                })}
              </div>
              {!skillCodes.length && <p className="mt-2 text-xs text-ink-muted">Map at least one skill for this course to appear in learning recommendations.</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saveCourse.loading}
                className="btn btn-primary"
              >
                {saveCourse.loading ? 'Saving...' : 'Save course'}
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setIsEditing(false);
                  setCurrentCourse(null);
                  setSkillCodes([]);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          {loading ? (
            <Loading label="Loading catalog" />
          ) : courses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table-enterprise w-full text-left text-[13px] text-ink-2">
                <thead className="border-b border-hairline text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">Title</th>
                    <th className="pb-3 pr-4 font-medium">Provider</th>
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    <th className="pb-3 pr-4 font-medium">Level</th>
                    <th className="pb-3 pr-4 font-medium">Skills</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {courses.map((course) => {
                    const isActive = course.isActive ?? true;
                    return (
                      <tr key={course._id} className={isActive ? '' : 'opacity-60'}>
                        <td className="py-3 pr-4 max-w-[220px]">
                          <span className="block truncate font-medium text-ink" title={course.title}>{course.title}</span>
                          <span className="text-[11px] text-ink-muted">{course.durationHours}h</span>
                        </td>
                        <td className="py-3 pr-4">{course.provider}</td>
                        <td className="py-3 pr-4">{course.category}</td>
                        <td className="py-3 pr-4 capitalize">{String(course.level ?? '').toLowerCase()}</td>
                        <td className="py-3 pr-4">{course.skills?.length || 0} mapped</td>
                        <td className="py-3 pr-4">
                          {isActive ? (
                            <span className="pill pill-success">
                              Active
                            </span>
                          ) : (
                            <span className="pill pill-neutral">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3 flex justify-end gap-2">
                          <button
                            type="button"
                            className="btn btn-ghost !p-1.5"
                            onClick={() => handleEdit(course)}
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost !p-1.5"
                            onClick={() => handleToggleStatus(course)}
                            title={isActive ? 'Deactivate' : 'Reactivate'}
                          >
                            {isActive ? <Trash2 size={15} /> : <Plus size={15} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No courses found in the catalog.</Empty>
          )}
        </Card>
      )}
    </div>
  );
}
