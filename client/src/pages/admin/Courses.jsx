import { useState } from 'react';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card, Empty, ErrorNote, Loading } from '../../components/ui.jsx';
import { useApi, useMutation } from '../../hooks/useApi.js';
import { api, endpoints } from '../../lib/index.js';

export default function Courses() {
  const [provider, setProvider] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentCourse, setCurrentCourse] = useState(null);
  const [mappings, setMappings] = useState([]);

  const query = provider ? `?provider=${encodeURIComponent(provider)}` : '';
  const { data, loading, error, refetch } = useApi(`${endpoints.adminCourses}${query}`, { deps: [provider] });
  const competenciesQuery = useApi(endpoints.competencies);

  const saveCourse = useMutation(async (courseData) => {
    if (currentCourse?._id) {
      await api.patch(`${endpoints.adminCourses}/${currentCourse._id}`, courseData);
    } else {
      await api.post(endpoints.adminCourses, courseData);
    }
  });

  const toggleStatus = useMutation(async (courseId, isActive) => {
    if (isActive) {
      await api.del(`${endpoints.adminCourses}/${courseId}`);
    } else {
      await api.patch(`${endpoints.adminCourses}/${courseId}`, { isActive: true });
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      code: formData.get('code'),
      title: formData.get('title'),
      provider: formData.get('provider'),
      url: formData.get('url'),
      description: formData.get('description'),
      durationHours: Number(formData.get('durationHours')),
      modality: formData.get('modality'),
      tags: formData.get('tags').split(',').map((t) => t.trim()).filter(Boolean),
      rating: Number(formData.get('rating')),
      isActive: currentCourse?.isActive ?? true,
      competencies: mappings
        .filter((mapping) => mapping.competency)
        .map((mapping) => ({
          competency: mapping.competency,
          targetLevel: Number(mapping.targetLevel),
          weight: Number(mapping.weight),
        })),
    };

    try {
      await saveCourse.run(payload);
      setIsEditing(false);
      setCurrentCourse(null);
      refetch();
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleEdit = (course) => {
    setCurrentCourse(course);
    setMappings((course.competencies ?? []).map((mapping) => ({
      competency: String(mapping.competency?._id ?? mapping.competency),
      targetLevel: mapping.targetLevel,
      weight: mapping.weight ?? 1,
    })));
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

  const courses = data?.courses ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">Course catalog</h1>
          <p className="mt-1 text-sm text-ink-2">Manage available learning resources and their mappings.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setCurrentCourse(null);
            setMappings([]);
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
              <option value="iGOT">iGOT</option>
              <option value="NSSTA">NSSTA</option>
              <option value="internal">Internal</option>
              <option value="other">Other</option>
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
              <div>
                <label className="label">Code</label>
                <input required name="code" className="field mt-1 w-full" defaultValue={currentCourse?.code} placeholder="e.g. IGOT-101" />
              </div>
              <div>
                <label className="label">Title</label>
                <input required name="title" className="field mt-1 w-full" defaultValue={currentCourse?.title} />
              </div>
              <div>
                <label className="label">Provider</label>
                <select required name="provider" className="field mt-1 w-full" defaultValue={currentCourse?.provider || 'iGOT'}>
                  <option value="iGOT">iGOT</option>
                  <option value="NSSTA">NSSTA</option>
                  <option value="internal">Internal</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">URL</label>
                <input type="url" name="url" className="field mt-1 w-full" defaultValue={currentCourse?.url} placeholder="https://..." />
              </div>
              <div>
                <label className="label">Duration (hours)</label>
                <input type="number" step="0.5" min="0" name="durationHours" className="field mt-1 w-full" defaultValue={currentCourse?.durationHours || 1} />
              </div>
              <div>
                <label className="label">Modality</label>
                <select name="modality" className="field mt-1 w-full" defaultValue={currentCourse?.modality || 'self_paced'}>
                  <option value="self_paced">Self-paced</option>
                  <option value="instructor_led">Instructor-led</option>
                  <option value="blended">Blended</option>
                </select>
              </div>
              <div>
                <label className="label">Tags (comma-separated)</label>
                <input name="tags" className="field mt-1 w-full" defaultValue={currentCourse?.tags?.join(', ')} placeholder="policy, leadership" />
              </div>
              <div>
                <label className="label">Initial Rating (1-5)</label>
                <input type="number" min="1" max="5" step="0.1" name="rating" className="field mt-1 w-full" defaultValue={currentCourse?.rating || 4.0} />
              </div>
            </div>
            
            <div>
              <label className="label">Description</label>
              <textarea name="description" rows="3" className="field mt-1 w-full" defaultValue={currentCourse?.description}></textarea>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="label">Competency mappings</label>
                <button
                  type="button"
                  className="text-xs font-medium text-ink underline"
                  onClick={() => setMappings([...mappings, { competency: '', targetLevel: 1, weight: 1 }])}
                >
                  Add mapping
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {mappings.map((mapping, index) => (
                  <div key={`${index}-${mapping.competency}`} className="grid gap-2 sm:grid-cols-[1fr_7rem_6rem_auto]">
                    <select
                      className="field"
                      value={mapping.competency}
                      onChange={(event) => setMappings(mappings.map((entry, i) => i === index ? { ...entry, competency: event.target.value } : entry))}
                    >
                      <option value="">Choose competency</option>
                      {(competenciesQuery.data?.competencies ?? []).map((competency) => (
                        <option key={competency._id} value={competency._id}>{competency.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      className="field"
                      value={mapping.targetLevel}
                      aria-label={`Target level ${index + 1}`}
                      onChange={(event) => setMappings(mappings.map((entry, i) => i === index ? { ...entry, targetLevel: event.target.value } : entry))}
                    />
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      className="field"
                      value={mapping.weight}
                      aria-label={`Weight ${index + 1}`}
                      onChange={(event) => setMappings(mappings.map((entry, i) => i === index ? { ...entry, weight: event.target.value } : entry))}
                    />
                    <button type="button" className="px-2 text-xs text-ink-muted hover:text-ink" onClick={() => setMappings(mappings.filter((_entry, i) => i !== index))}>
                      Remove
                    </button>
                  </div>
                ))}
                {!mappings.length && <p className="text-xs text-ink-muted">Add at least one mapping for this course to appear in learning recommendations.</p>}
              </div>
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
                  setMappings([]);
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
                    <th className="pb-3 pr-4 font-medium">Code</th>
                    <th className="pb-3 pr-4 font-medium">Title</th>
                    <th className="pb-3 pr-4 font-medium">Provider</th>
                    <th className="pb-3 pr-4 font-medium">Duration</th>
                    <th className="pb-3 pr-4 font-medium">Modality</th>
                    <th className="pb-3 pr-4 font-medium">Competencies</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {courses.map((course) => {
                    const isActive = course.isActive ?? true;
                    return (
                      <tr key={course._id} className={isActive ? '' : 'opacity-60'}>
                        <td className="py-3 pr-4 font-medium text-ink">{course.code}</td>
                        <td className="py-3 pr-4 max-w-[200px] truncate" title={course.title}>
                          {course.title}
                        </td>
                        <td className="py-3 pr-4 capitalize">{course.provider}</td>
                        <td className="py-3 pr-4">{course.durationHours}h</td>
                        <td className="py-3 pr-4 capitalize">{course.modality}</td>
                        <td className="py-3 pr-4">{course.competencies?.length || 0} mapped</td>
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
