const BASE = '/api';
const TOKEN_KEY = 'statskill.token';

/**
 * The only place the app talks to the API.
 *
 * The token lives in localStorage. That is the usual prototype choice and it is
 * readable by any script on the page, so it is only defensible while there is no
 * third-party script here; the production answer is an httpOnly, SameSite=Strict
 * cookie plus CSRF protection, which needs a server-side session change too.
 */

export class ApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorised = null;

/** Lets AuthContext own what a 401 means without api.js importing React. */
export function setUnauthorisedHandler(handler) {
  onUnauthorised = handler;
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const token = tokenStore.get();
  const isForm = body instanceof FormData;

  const response = await fetch(`${BASE}${path}`, {
    method,
    signal,
    headers: {
      ...(isForm ? {} : body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);
  // The API's error shape is { error: { message, details } }.
  const message = payload?.error?.message ?? payload?.error;

  // A 401 while holding a token means the session died; a 401 without one is
  // just a rejected sign-in, and must not be reported as an expiry.
  if (response.status === 401 && token) {
    tokenStore.clear();
    onUnauthorised?.();
    throw new ApiError(message ?? 'Your session has expired. Sign in again.', { status: 401 });
  }

  if (!response.ok) {
    throw new ApiError(message ?? `Request failed (${response.status}).`, {
      status: response.status,
      details: payload?.error?.details,
    });
  }

  return payload;
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

/** Endpoint map - one edit site when a route moves. */
export const endpoints = {
  login: '/auth/login',
  register: '/auth/register',
  registerOptions: '/auth/register/options',
  me: '/auth/me',
  profile: '/profile/me',
  uploadCv: '/profile/me/documents',
  competencies: '/competencies',
  myCompetencies: '/profile/me/competencies',
  myRequirements: '/profile/me/requirements',
  assessmentStart: '/assessments/start',
  assessmentSubmit: '/assessments/submit',
  recommendations: '/recommendations/me',
  recomputePath: '/recommendations/me/recompute',
  quizStart: '/quiz/start',
  quizSubmit: '/quiz/submit',
  quizHistory: '/quiz/me',
  progress: '/learning/me',
  enroll: '/learning/enroll',
  complete: '/learning/complete',
  assistant: '/assistant',
  adminOverview: '/admin/overview',
  adminHeatmap: '/admin/heatmap',
  adminGaps: '/admin/gaps',
  adminOfficers: '/admin/officers',
  adminCourses: '/admin/courses',
  adminQuestions: '/admin/questions',
  gamificationStreak: '/gamification/streak',
  gamificationLeaderboard: '/gamification/leaderboard',
  gamificationBadges: '/gamification/badges',
  discussionGroups: '/discussions/groups',
  trainerMaterials: '/trainer/materials',
  trainerUploadMaterial: '/trainer/upload-material',
  trainerGenerateQuiz: '/trainer/generate-quiz',
  trainerPublishQuiz: '/trainer/publish-quiz',
  trainerAnalytics: '/trainer/analytics',
};
