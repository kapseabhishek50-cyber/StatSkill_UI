import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, FileUp, Save, Sparkles } from 'lucide-react';
import { Card, Empty, ErrorNote, Loading } from '../../components/ui.jsx';
import { useApi, useMutation } from '../../hooks/useApi.js';
import { api, endpoints, formatDate, levelLabel, percent } from '../../lib/index.js';

const FIELDS = [
  { key: 'designation', label: 'Designation' },
  { key: 'cadre', label: 'Cadre / service' },
  { key: 'postingLocation', label: 'Posting location' },
  { key: 'experienceYears', label: 'Years of service', type: 'number' },
];

export default function Profile() {
  const profile = useApi(endpoints.profile);
  const [draft, setDraft] = useState(null);
  const [file, setFile] = useState(null);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

  const save = useMutation(async (body) => {
    const result = await api.patch(endpoints.profile, body);
    profile.setData(result);
    setSaved(true);
    return result;
  });

  const upload = useMutation(async (selected) => {
    const form = new FormData();
    form.append('document', selected);
    const result = await api.post(endpoints.uploadCv, form);
    profile.setData(result);
    setFile(null);
    return result;
  });

  if (profile.loading) return <Loading label="Loading your profile" />;

  const record = draft ?? profile.data?.profile ?? {};
  const extracted = profile.data?.profile?.extractedSkills ?? [];
  const documents = profile.data?.profile?.sourceDocuments ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Profile</h1>
        <p className="mt-1 text-sm text-ink-2">
          Service details feed the gap engine. Uploading a CV suggests competencies; it does not set
          your levels — those come from the assessment and from quizzes.
        </p>
      </div>

      <ErrorNote error={profile.error ?? save.error ?? upload.error} onRetry={profile.refetch} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Service details">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.run(record);
            }}
          >
            {FIELDS.map((field) => (
              <div key={field.key}>
                <label htmlFor={field.key} className="label">
                  {field.label}
                </label>
                <input
                  id={field.key}
                  type={field.type ?? 'text'}
                  className="field mt-1"
                  value={record[field.key] ?? ''}
                  onChange={(event) => {
                    setSaved(false);
                    setDraft({
                      ...record,
                      [field.key]:
                        field.type === 'number' ? Number(event.target.value) : event.target.value,
                    });
                  }}
                />
              </div>
            ))}

            <div>
              <label htmlFor="qualifications" className="label">
                Qualifications (comma separated)
              </label>
              <input
                id="qualifications"
                className="field mt-1"
                value={(record.qualifications ?? []).join(', ')}
                onChange={(event) => {
                  setSaved(false);
                  setDraft({
                    ...record,
                    qualifications: event.target.value
                      .split(',')
                      .map((part) => part.trim())
                      .filter(Boolean),
                  });
                }}
              />
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary" disabled={save.loading}>
                <Save size={15} aria-hidden="true" />
                {save.loading ? 'Saving…' : 'Save details'}
              </button>
              {saved && <span className="text-xs" style={{ color: 'var(--delta-up)' }}>Saved</span>}
            </div>
          </form>
        </Card>

        <div className="space-y-5">
          <Card
            title="CV or service record"
            subtitle="PDF, DOCX, or PPTX. Text is extracted once on upload, so nothing is re-read later."
          >
            <div className="flex flex-wrap items-center gap-3">
              <label className="btn-quiet cursor-pointer">
                <FileUp size={15} aria-hidden="true" />
                {file ? file.name : 'Choose file'}
                <input
                  type="file"
                  accept=".pdf,.docx,.pptx"
                  className="hidden"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={!file || upload.loading}
                onClick={() => upload.run(file)}
              >
                <Sparkles size={15} aria-hidden="true" />
                {upload.loading ? 'Reading…' : 'Extract skills'}
              </button>
            </div>

            {documents.length > 0 && (
              <ul className="mt-4 space-y-1 text-xs text-ink-2">
                {documents.map((document) => (
                  <li key={document.uploadedAt}>
                    {document.filename} · {formatDate(document.uploadedAt)}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Extracted skills"
            subtitle="Suggestions with the evidence they came from. Confidence is the model’s, not a level."
          >
            {!extracted.length && <Empty>Upload a document to see suggestions.</Empty>}
            <ul className="space-y-3">
              {extracted.slice(0, 10).map((skill) => (
                <li key={skill.term} className="border-t border-hairline pt-3 first:border-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm text-ink">{skill.term}</p>
                    <p className="tnum shrink-0 text-xs text-ink-muted">
                      {levelLabel(skill.impliedLevel)} · {percent(skill.confidence)}
                    </p>
                  </div>
                  {skill.evidence && (
                    <p className="mt-0.5 text-xs italic text-ink-muted">“{skill.evidence}”</p>
                  )}
                </li>
              ))}
            </ul>

            {extracted.length > 0 && (
              <div className="mt-4 border-t border-hairline pt-4">
                <p className="text-xs text-ink-2">
                  These suggestions can pre-fill your self-assessment. Implied levels become starting
                  ratings — you can adjust each one before submitting.
                </p>
                <button
                  type="button"
                  className="btn-primary mt-3 text-xs"
                  onClick={() =>
                    navigate('/assessment', {
                      state: {
                        prefill: extracted.reduce((acc, skill) => {
                          const competencyId = skill.competency?._id ?? skill.competency;
                          if (competencyId) acc[String(competencyId)] = skill.impliedLevel;
                          return acc;
                        }, {}),
                      },
                    })
                  }
                >
                  <ClipboardCheck size={14} aria-hidden="true" />
                  Use as starting point for assessment
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
