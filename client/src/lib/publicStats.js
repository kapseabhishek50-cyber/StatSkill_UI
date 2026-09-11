/**
 * Live platform numbers for the public website.
 *
 * The landing page calls GET /api/stats/public on every mount. When the API
 * answers, the numbers on screen are real database counts. When the API is
 * unreachable (offline demo, static export, DB down) we fall back to the
 * bundled seed snapshot and the UI labels it accordingly — a visitor never
 * sees an error on the public page.
 */

export const FALLBACK_STATS = {
  live: false,
  source: 'snapshot',
  stats: {
    officers: 15,
    competencies: 20,
    courses: 23,
    departments: 8,
    jobRoles: 10,
    assessments: 0,
    quizzes: 0,
    competencyRecords: 0,
    communities: 6,
  },
  competencies: [
    { code: 'SURVEY_DESIGN', name: 'Survey Design and Sampling', category: 'domain', futureDemand: 0.8 },
    { code: 'NAT_ACCOUNTS', name: 'National Accounts Compilation', category: 'domain', futureDemand: 0.7 },
    { code: 'PRICE_STATS', name: 'Price Statistics and Index Numbers', category: 'domain', futureDemand: 0.6 },
    { code: 'ECON_STATS', name: 'Industrial and Economic Statistics', category: 'domain', futureDemand: 0.6 },
    { code: 'CENSUS_OPS', name: 'Large-Scale Enumeration Operations', category: 'domain', futureDemand: 0.5 },
    { code: 'STAT_INFERENCE', name: 'Statistical Inference', category: 'technical', futureDemand: 0.7 },
    { code: 'REGRESSION', name: 'Regression and Modelling', category: 'technical', futureDemand: 0.8 },
    { code: 'DATA_QUALITY', name: 'Data Quality and Validation', category: 'technical', futureDemand: 0.7 },
    { code: 'PYTHON', name: 'Python for Official Statistics', category: 'digital', futureDemand: 0.9 },
    { code: 'R_STATS', name: 'R for Statistical Analysis', category: 'digital', futureDemand: 0.7 },
    { code: 'SQL_DATA', name: 'SQL and Administrative Data', category: 'digital', futureDemand: 0.8 },
    { code: 'DATA_VIS', name: 'Data Visualisation and Storytelling', category: 'digital', futureDemand: 0.8 },
    { code: 'AI_ML', name: 'AI and Machine Learning Foundations', category: 'digital', futureDemand: 0.9 },
    { code: 'POLICY_BRIEF', name: 'Policy Brief Writing', category: 'behavioural', futureDemand: 0.6 },
    { code: 'DATA_ETHICS', name: 'Data Ethics and Confidentiality', category: 'behavioural', futureDemand: 0.7 },
    { code: 'PROJ_MGMT', name: 'Statistical Project Management', category: 'behavioural', futureDemand: 0.5 },
  ],
  categories: [
    { category: 'domain', count: 7 },
    { category: 'digital', count: 5 },
    { category: 'technical', count: 4 },
    { category: 'behavioural', count: 4 },
  ],
  courses: [
    { code: 'IGOT-SAMP-101', title: 'Foundations of Sample Survey Design', provider: 'iGOT', rating: 4.4, durationHours: 12 },
    { code: 'NSSTA-SAMP-401', title: 'Complex Survey Estimation and Variance', provider: 'NSSTA', rating: 4.6, durationHours: 40 },
    { code: 'IGOT-PY-201', title: 'Python for Statistical Data Processing', provider: 'iGOT', rating: 4.5, durationHours: 24 },
    { code: 'NSSTA-ACC-301', title: 'National Accounts in Practice', provider: 'NSSTA', rating: 4.7, durationHours: 36 },
    { code: 'IGOT-DQ-102', title: 'Data Quality Assessment Toolkit', provider: 'iGOT', rating: 4.3, durationHours: 10 },
  ],
  health: { db: 'unknown', llmProvider: 'mock' },
};

/**
 * Fetches the public stats with a hard timeout. Never throws.
 * Returns { data, live } where live=false means the bundled snapshot is shown.
 */
export async function fetchPublicStats(timeoutMs = 5000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch('/api/stats/public', { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    if (!data?.stats) throw new Error('malformed payload');
    return { data, live: data.live === true };
  } catch {
    return { data: FALLBACK_STATS, live: false };
  }
}
