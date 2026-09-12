const BASE = '/api';
const TOKEN_KEY = 'statskill.token';
const REFRESH_KEY = 'statskill.refresh';

/**
 * The only place the app talks to the API.
 *
 * The new backend wraps every response in { success, data, message } and every
 * error in { success: false, message, code, errors }. This module unwraps the
 * envelope so pages always receive the `data` payload (or throw ApiError).
 *
 * Auth uses short-lived access tokens + rotating refresh tokens. On a 401 the
 * client attempts one silent refresh before reporting the session as expired.
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

export const refreshStore = {
  get: () => localStorage.getItem(REFRESH_KEY),
  set: (token) => localStorage.setItem(REFRESH_KEY, token),
  clear: () => localStorage.removeItem(REFRESH_KEY),
};

let onUnauthorised = null;

/** Lets AuthContext own what a 401 means without api.js importing React. */
export function setUnauthorisedHandler(handler) {
  onUnauthorised = handler;
}

// Single-flight refresh: concurrent 401s share one rotation request.
let refreshPromise = null;

async function tryRefresh() {
  if (refreshPromise) return refreshPromise;
  const refreshToken = refreshStore.get();
  if (!refreshToken) return null;
  refreshPromise = fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data?.accessToken) throw new Error('refresh failed');
      tokenStore.set(payload.data.accessToken);
      if (payload.data.refreshToken) refreshStore.set(payload.data.refreshToken);
      return payload.data;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

function failSession(message) {
  tokenStore.clear();
  refreshStore.clear();
  onUnauthorised?.();
  throw new ApiError(message ?? 'Your session has expired. Sign in again.', { status: 401 });
}

async function request(path, { method = 'GET', body, signal, _retried = false } = {}) {
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
  const message = payload?.message ?? payload?.error?.message ?? payload?.error;

  if (response.status === 401 && token && !_retried) {
    // The access token may simply have expired — rotate once, then retry.
    const rotated = await tryRefresh();
    if (rotated) return request(path, { method, body, signal, _retried: true });
    failSession(message);
  }

  // A 401 while holding a token means the session died; a 401 without one is
  // just a rejected sign-in, and must not be reported as an expiry.
  if (response.status === 401 && token) {
    failSession(message);
  }

  if (!response.ok) {
    throw new ApiError(message ?? `Request failed (${response.status}).`, {
      status: response.status,
      details: payload?.errors ?? payload?.error?.details,
    });
  }

  // Unwrap the { success, data } envelope; tolerate bare payloads too.
  if (payload && typeof payload === 'object' && 'success' in payload) {
    return payload.data ?? null;
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
  refresh: '/auth/refresh',
  logout: '/auth/logout',
  me: '/auth/me',
  profile: '/profile/me',
  uploadCv: '/profile/me/documents',
  competencies: '/competencies',
  myCompetencies: '/profile/me/competencies',
  myRequirements: '/profile/me/requirements',
  assessmentStart: '/assessment/start',
  assessmentSubmit: '/assessment/self',
  recommendations: '/recommendations/top?limit=12',
  skillGaps: '/skill-gaps/me',
  recomputeRecommendations: '/recommendations/refresh',
  quizList: '/quizzes?limit=50',
  quizDetail: (id) => `/quizzes/${id}`,
  quizSubmit: (id) => `/quizzes/${id}/submit`,
  quizHistory: '/quizzes/attempts/me',
  progress: '/learning/summary',
  enroll: (courseId) => `/learning/enroll/${courseId}`,
  complete: (courseId) => `/learning/${courseId}/complete`,
  myLearning: '/learning/my-courses',
  activity: '/learning/activity?limit=200',
  assistant: '/ai/chat',
  adminOverview: '/admin/dashboard',
  adminHeatmap: '/admin/heatmap',
  adminGaps: '/admin/skill-gaps',
  adminOfficers: '/admin/users',
  adminCourses: '/admin/courses?limit=100',
  adminQuestions: '/admin/quizzes',
  gamificationStreak: '/streak',
  gamificationLeaderboard: '/leaderboard',
  gamificationBadges: '/achievements/me',
  achievementsAll: '/achievements',
  discussionGroups: '/communities',
  communityMessages: (id) => `/communities/${id}/messages?limit=100`,
  communitySend: (id) => `/communities/${id}/messages`,
  communityAskAi: (id) => `/communities/${id}/ask-ai`,
  trainerMaterials: '/trainer/materials',
  trainerMaterial: (id) => `/materials/${id}`,
  trainerUploadMaterial: '/trainer/materials',
  trainerGenerateQuiz: '/trainer/quizzes/generate',
  trainerQuizzes: '/trainer/quizzes',
  trainerQuizResults: (id) => `/trainer/quizzes/${id}/results`,
  trainerPublishQuiz: (id) => `/trainer/quizzes/${id}/publish`,
  trainerArchiveQuiz: (id) => `/trainer/quizzes/${id}/archive`,
  trainerAnalytics: '/trainer/analytics',
};
