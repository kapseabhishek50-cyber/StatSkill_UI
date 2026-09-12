import { useState } from 'react';
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  Check,
  BookOpen,
  Send,
} from 'lucide-react';
import { Card, Loading, ErrorNote, Empty } from '../../components/ui.jsx';
import { useApi, useMutation } from '../../hooks/useApi.js';
import { api, endpoints } from '../../lib/index.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function QuizGenerator() {
  const compApi = useApi(endpoints.competencies);
  const competencies = compApi.data?.competencies ?? [];

  const [file, setFile] = useState(null);
  const [competencyCode, setCompetencyCode] = useState('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [language, setLanguage] = useState('english');
  const [title, setTitle] = useState('');

  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [uploadResult, setUploadResult] = useState(null);
  const [draftQuizId, setDraftQuizId] = useState(null);
  const [published, setPublished] = useState(false);
  const [stage, setStage] = useState('');

  // 1. Upload → wait for extraction → generate draft quiz.
  const generateMutation = useMutation(async () => {
    if (!file) throw new Error('Please select a training document (PDF, DOCX, PPTX, or TXT).');
    if (!competencyCode) throw new Error('Please select a target competency.');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name.replace(/\.[^.]+$/, ''));

    // Step A: upload (extraction runs as a background job).
    setStage('Uploading document…');
    const uploadRes = await api.post(endpoints.trainerUploadMaterial, formData);
    const material = uploadRes.material;
    if (!material?._id && !material?.id) throw new Error('Upload did not return a material id.');
    const materialId = String(material._id ?? material.id);

    // Step B: wait until the text is extracted and chunked.
    setStage('Extracting text from the document…');
    let ready = null;
    for (let attempt = 0; attempt < 45; attempt += 1) {
      await sleep(2000);
      const current = await api.get(endpoints.trainerMaterial(materialId));
      if (current.material?.status === 'READY') {
        ready = current.material;
        break;
      }
      if (current.material?.status === 'FAILED') {
        throw new Error(`Extraction failed: ${current.material?.error ?? 'unreadable document'}`);
      }
    }
    if (!ready) throw new Error('Extraction is taking too long — the material is saved; retry generation from it later.');
    setUploadResult({ filename: ready.originalName ?? file.name, chars: ready.extractedChars ?? 0 });

    // Step C: generate MCQs from the extracted text (stored as a draft quiz).
    setStage('Generating validated questions…');
    const genRes = await api.post(endpoints.trainerGenerateQuiz, {
      materialId,
      competencyCode,
      count,
      difficulty,
      language,
    });
    const quiz = genRes.quiz;
    setDraftQuizId(String(quiz._id ?? quiz.id));
    setGeneratedQuestions(
      (quiz.questions ?? []).map((q) => ({
        stem: q.question,
        options: (q.options ?? []).map((text, i) => ({ text, isCorrect: i === q.correctAnswer })),
        explanation: q.explanation,
      })),
    );
    setPublished(false);
    setStage('');
  });

  // 2. Publish the reviewed draft to the live quiz bank.
  const publishMutation = useMutation(async () => {
    if (!draftQuizId) return;
    await api.post(endpoints.trainerPublishQuiz(draftQuizId), {});
    setPublished(true);
  });

  if (compApi.loading) return <Loading label="Loading competency framework" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="icon-chip">
            <Sparkles size={20} />
          </span>
          <h1 className="text-h1 font-bold text-ink">AI Document-to-Quiz Generator</h1>
        </div>
        <p className="mt-0.5 text-[13px] text-ink-2">
          Upload official training materials, survey handbooks, or methodology circulars (PDF, DOCX, PPTX, TXT) to generate mechanically validated objective assessments.
        </p>
      </div>

      <ErrorNote error={generateMutation.error || publishMutation.error || compApi.error} />

      {/* Generator Configuration Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Form: Upload & Controls */}
        <div className="lg:col-span-5 space-y-4">
          <Card title="Upload Learning Material">
            {/* File Dropzone */}
            <div className="mt-2 flex justify-center rounded-card border-2 border-dashed border-hairline px-6 pt-5 pb-6 text-center hover:border-primary transition-colors duration-200">
              <div className="space-y-2">
                <UploadCloud size={28} strokeWidth={1.5} className="mx-auto text-ink-muted" />
                <div className="flex text-xs text-ink-2 justify-center">
                  <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-primary hover:underline">
                    <span>{file ? file.name : 'Upload training material'}</span>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.docx,.pptx,.txt"
                      className="sr-only"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
                <p className="text-[11px] text-ink-muted">PDF, DOCX, PPTX presentations, or plain text up to 10MB</p>
              </div>
            </div>

            {/* Parameters */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Training Module Title</label>
                <input
                  type="text"
                  placeholder="e.g. Sampling & Estimation Workshop Module 2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="field text-xs w-full mt-1"
                />
              </div>

              <div>
                <label className="label">Target Competency</label>
                <select
                  value={competencyCode}
                  onChange={(e) => setCompetencyCode(e.target.value)}
                  className="field text-xs w-full mt-1"
                >
                  <option value="">Select Competency...</option>
                  {competencies.map((c) => (
                    <option key={c._id} value={c.code}>
                      {c.name} ({c.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label">Questions</label>
                  <select
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="field text-xs w-full mt-1"
                  >
                    <option value={5}>5 MCQs</option>
                    <option value={10}>10 MCQs</option>
                    <option value={20}>20 MCQs</option>
                  </select>
                </div>
                <div>
                  <label className="label">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="field text-xs w-full mt-1"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label className="label">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="field text-xs w-full mt-1"
                  >
                    <option value="english">English</option>
                    <option value="hindi">Hindi</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={() => generateMutation.run()}
                disabled={!file || !competencyCode || generateMutation.loading}
                className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2 mt-4"
              >
                <Sparkles size={16} />
                <span>{generateMutation.loading ? stage || 'Working…' : 'Generate Validated MCQs'}</span>
              </button>
            </div>
          </Card>
        </div>

        {/* Right Area: Generated Questions Preview & Publish */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            title={
              generatedQuestions.length > 0
                ? `Generated Assessment (${generatedQuestions.length} Questions)`
                : 'Generated Assessment Preview'
            }
            subtitle="Strictly verified: 1 correct option, 3 plausible distractors, no stem leakage, and full reasoning."
            action={
              generatedQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => publishMutation.run()}
                  disabled={publishMutation.loading || published}
                  className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-all ${
                    published
                      ? 'bg-good text-white'
                      : 'btn-primary'
                  }`}
                >
                  {published ? (
                    <>
                      <Check size={14} /> Published to Quiz Bank
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Publish to Live Quiz Bank
                    </>
                  )}
                </button>
              )
            }
          >
            {generateMutation.loading ? (
              <Loading label={stage || 'Extracting document text and running mechanical validation'} />
            ) : generatedQuestions.length === 0 ? (
              <Empty>
                Upload a training document on the left and click &quot;Generate Validated MCQs&quot; to preview synthesized questions.
              </Empty>
            ) : (
              <div className="space-y-4 pt-1">
                {uploadResult && (
                  <div className="flex items-center gap-2 rounded-button bg-plane border border-hairline p-3 text-xs text-ink-2">
                    <BookOpen size={14} className="text-primary shrink-0" />
                    <span>
                      Synthesized from <strong>{uploadResult.filename}</strong> ({uploadResult.chars.toLocaleString()} chars parsed).
                    </span>
                  </div>
                )}

                {generatedQuestions.map((q, idx) => (
                  <div key={idx} className="rounded-card border border-hairline bg-surface p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-primary">Question {idx + 1}</span>
                      <span className="pill pill-success !text-[10px]">
                        <CheckCircle2 size={10} /> Mechanically Validated
                      </span>
                    </div>

                    <p className="text-xs font-medium text-ink leading-relaxed">{q.stem}</p>

                    <div className="space-y-1.5">
                      {q.options?.map((opt, optIdx) => (
                        <div
                          key={optIdx}
                          className={`flex items-start gap-2 rounded-lg p-2 text-xs transition-colors ${
                            opt.isCorrect
                              ? 'border border-good bg-plane font-semibold text-ink'
                              : 'border border-hairline bg-surface-2 text-ink-2'
                          }`}
                        >
                          <span className="text-[11px] font-mono shrink-0">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          <span>{opt.text}</span>
                          {opt.isCorrect && <Check size={14} className="ml-auto text-good shrink-0" />}
                        </div>
                      ))}
                    </div>

                    {q.explanation && (
                      <div className="rounded-lg bg-surface-2 p-2.5 text-[11px] text-ink-2 border border-hairline">
                        <strong className="text-ink">Explanation: </strong>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
