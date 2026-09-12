/**
 * OpenAPI 3.0 spec served at /api/docs.json + Swagger UI at /api/docs.
 * Kept hand-authored for precision (prompt §49); a Postman collection ships in docs/.
 */
const envelope = (dataSchema: object) => ({
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    message: { type: 'string' },
    data: dataSchema,
  },
});

const errorEnvelope = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' },
    code: { type: 'string', example: 'VALIDATION_ERROR' },
    errors: { type: 'array', items: { type: 'object' } },
  },
};

const pagination = {
  page: { type: 'integer', example: 1 },
  limit: { type: 'integer', example: 20 },
  total: { type: 'integer', example: 120 },
  totalPages: { type: 'integer', example: 6 },
};

const security = [{ bearerAuth: [] }];

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'StatSkill AI Backend API',
    version: '1.0.0',
    description:
      "Backend for StatSkill AI — an AI-powered learning and competency development platform for India's Official Statistical System.\n\n" +
      '**Hybrid recommendation engine**: deterministic competency-gap scoring + semantic embeddings + optional AI explanation. AI never decides rankings — it only explains them.\n\n' +
      'All responses use the envelope `{ success, data, message }`; errors use `{ success: false, message, code, errors }`.',
  },
  servers: [{ url: '/', description: 'Current host' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ErrorEnvelope: errorEnvelope,
      PublicStatsResponse: {
        type: 'object',
        required: ['live', 'source', 'generatedAt', 'stats'],
        properties: {
          live: { type: 'boolean', description: 'True when the numbers are real database counts.', example: true },
          source: { type: 'string', enum: ['database', 'snapshot'] },
          generatedAt: { type: 'string', format: 'date-time' },
          stats: {
            type: 'object',
            properties: {
              officers: { type: 'integer', description: 'Active user accounts' },
              competencies: { type: 'integer', description: 'Active competencies in the framework' },
              courses: { type: 'integer', description: 'Active courses in the catalogue' },
              departments: { type: 'integer', description: 'Distinct departments with at least one member' },
              jobRoles: { type: 'integer', description: 'Active roles in the requirement matrix' },
              assessments: { type: 'integer', description: 'Completed assessments' },
              quizzes: { type: 'integer', description: 'Recorded quiz attempts' },
              competencyRecords: { type: 'integer', description: 'Measured officer-competency scores' },
              communities: { type: 'integer', description: 'Active learning communities' },
            },
          },
          competencies: {
            type: 'array',
            description: 'Up to 16 framework entries for the landing-page ticker.',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'AI_ML' },
                name: { type: 'string', example: 'AI/ML' },
                category: { type: 'string', enum: ['STATISTICAL', 'TECHNICAL', 'DIGITAL_GOVERNANCE', 'BEHAVIOURAL'] },
              },
            },
          },
          categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: { category: { type: 'string' }, count: { type: 'integer' } },
            },
          },
          courses: {
            type: 'array',
            description: 'Up to 12 highest-rated catalogue entries.',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string', description: 'externalId when present, else a slug of the title' },
                title: { type: 'string' },
                provider: { type: 'string', example: 'NSSTA' },
                rating: { type: 'number' },
                durationHours: { type: 'number' },
                level: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
              },
            },
          },
          health: {
            type: 'object',
            properties: {
              db: { type: 'string', enum: ['up', 'down'] },
              aiProvider: { type: 'string', enum: ['gemini', 'openai', 'mock'] },
              aiConfigured: { type: 'boolean' },
            },
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', example: 'rahul.sharma@mospi.gov.in' }, password: { type: 'string', example: 'Demo@123' } },
      },
      AuthResponse: envelope({
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      }),
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'Rahul Sharma' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['LEARNER', 'TRAINER', 'ADMIN'] },
          designation: { type: 'string', example: 'Statistical Officer' },
          department: { type: 'string' },
          experience: { type: 'number', example: 5 },
          xp: { type: 'integer' },
          level: { type: 'integer' },
        },
      },
      AssessmentStartRequest: {
        type: 'object',
        properties: {
          competencyCodes: { type: 'array', items: { type: 'string' }, example: ['AI_ML', 'PYTHON'] },
          questionCount: { type: 'integer', example: 15, minimum: 5, maximum: 30 },
          type: { type: 'string', enum: ['ROLE_BASED', 'FULL', 'COMPETENCY', 'DIAGNOSTIC'] },
        },
      },
      AssessmentSubmitRequest: {
        type: 'object',
        required: ['answers'],
        properties: {
          answers: {
            type: 'array',
            items: {
              type: 'object',
              required: ['questionId', 'selectedIndex'],
              properties: { questionId: { type: 'string' }, selectedIndex: { type: 'integer', minimum: -1, maximum: 3 } },
            },
          },
          timeTakenSeconds: { type: 'integer' },
        },
      },
      Recommendation: {
        type: 'object',
        properties: {
          courseId: { type: 'string' },
          title: { type: 'string' },
          matchScore: { type: 'integer', example: 94 },
          skill: { type: 'string', example: 'AI/ML' },
          reason: { type: 'string' },
          priority: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
          scores: {
            type: 'object',
            properties: {
              gap: { type: 'number' },
              role: { type: 'number' },
              semantic: { type: 'number' },
              difficulty: { type: 'number' },
              history: { type: 'number' },
              popularity: { type: 'number' },
              freshness: { type: 'number' },
              final: { type: 'number' },
            },
          },
          reasonSource: { type: 'string', enum: ['AI', 'DETERMINISTIC'] },
        },
      },
      RecommendationsResponse: envelope({
        type: 'object',
        properties: {
          recommendations: { type: 'array', items: { $ref: '#/components/schemas/Recommendation' } },
          pagination: { type: 'object', properties: pagination },
        },
      }),
      QuizSubmitRequest: {
        type: 'object',
        required: ['answers'],
        properties: {
          answers: {
            type: 'array',
            items: {
              type: 'object',
              required: ['questionId', 'selectedIndex'],
              properties: { questionId: { type: 'string' }, selectedIndex: { type: 'integer', minimum: -1, maximum: 3 } },
            },
          },
          timeTakenSeconds: { type: 'integer' },
        },
      },
      ChatRequest: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', example: 'Why is AI/ML my biggest gap?' },
          history: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, content: { type: 'string' } } } },
        },
      },
    },
  },
  tags: [
    { name: 'Auth', description: 'Register, login, refresh, logout' },
    { name: 'Profile', description: 'User profile' },
    { name: 'Dashboard', description: 'Aggregated dashboard endpoint' },
    { name: 'Competencies', description: 'Competency taxonomy + user scores' },
    { name: 'Assessment', description: 'Competency assessment engine' },
    { name: 'Skill Gaps', description: 'Skill-gap engine' },
    { name: 'Recommendations', description: 'Hybrid recommendation engine' },
    { name: 'Courses', description: 'Course catalogue + search' },
    { name: 'Learning', description: 'Enrollment, progress, learning paths' },
    { name: 'Quizzes', description: 'Quiz taking (learners)' },
    { name: 'Materials', description: 'Learning material upload + processing' },
    { name: 'Gamification', description: 'Streaks, achievements, activity' },
    { name: 'Community', description: 'Communities + messages' },
    { name: 'Notifications', description: 'User notifications' },
    { name: 'AI', description: 'AI assistant + status' },
    { name: 'Trainer', description: 'Trainer features' },
    { name: 'Admin', description: 'Admin features + analytics' },
    { name: 'Search', description: 'Global search' },
    { name: 'Health', description: 'Health checks' },
    { name: 'Public Stats', description: 'Unauthenticated landing-page numbers' },
  ],
  paths: {
    '/api/stats/public': {
      get: {
        tags: ['Public Stats'],
        summary: 'Public platform snapshot for the landing page',
        description:
          'Unauthenticated aggregate counts (officers, competencies, courses, departments, job roles, ' +
          'assessments, quiz attempts, competency records, communities) plus framework and catalogue previews. ' +
          'Answers 200 with a bundled seed snapshot and `live: false` when MongoDB is unreachable, so the ' +
          'public page never errors. Returns the bare payload (not the success envelope) because it is read ' +
          'directly by a plain fetch on the marketing site.',
        security: [],
        responses: {
          200: {
            description: 'Public stats payload (live database counts, or seed snapshot when DB is down)',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PublicStatsResponse' } },
            },
          },
        },
      },
    },
    '/api/health': {
      get: { tags: ['Health'], summary: 'Liveness probe', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/api/health/detailed': {
      get: { tags: ['Health'], summary: 'Detailed component health', security: [], responses: { 200: { description: 'Component statuses' } } },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account (LEARNER/TRAINER)',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
                  password: { type: 'string', minLength: 8 },
                  role: { type: 'string', enum: ['LEARNER', 'TRAINER'] },
                  designation: { type: 'string' },
                  department: { type: 'string' },
                  experience: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } }, 409: { description: 'Email exists' }, 422: { description: 'Validation error' } },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } }, 401: { description: 'Invalid credentials' } },
      },
    },
    '/api/auth/refresh': {
      post: { tags: ['Auth'], summary: 'Rotate refresh token', security: [], responses: { 200: { description: 'New token pair' }, 401: { description: 'Invalid/expired' } } },
    },
    '/api/auth/logout': { post: { tags: ['Auth'], summary: 'Logout (revoke refresh token)', security, responses: { 200: { description: 'Logged out' } } } },
    '/api/auth/me': { get: { tags: ['Auth'], summary: 'Current user', security, responses: { 200: { description: 'User' }, 401: { description: 'Unauthorized' } } } },
    '/api/dashboard': { get: { tags: ['Dashboard'], summary: 'Single optimized dashboard payload', security, responses: { 200: { description: 'user, competency, skillGaps, recommendations, continueLearning, streak, achievements, recentActivity, notifications' } } } },
    '/api/profile/me': {
      get: { tags: ['Profile'], summary: 'Get profile + competencies', security, responses: { 200: { description: 'Profile' } } },
      put: { tags: ['Profile'], summary: 'Update profile', security, responses: { 200: { description: 'Updated' } } },
    },
    '/api/profile/learning-profile': { get: { tags: ['Profile'], summary: 'Semantic learning profile used by the recommender', security, responses: { 200: { description: 'Learning profile' } } } },
    '/api/competencies': { get: { tags: ['Competencies'], summary: 'Taxonomy + role mappings + thresholds', security, responses: { 200: { description: 'Competencies' } } } },
    '/api/competencies/me': { get: { tags: ['Competencies'], summary: 'Measured competencies of current user', security, responses: { 200: { description: 'User competencies' } } } },
    '/api/assessment/start': {
      post: {
        tags: ['Assessment'],
        summary: 'Generate + start an assessment (role/gap-aware, AI-validated questions)',
        security,
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AssessmentStartRequest' } } } },
        responses: { 201: { description: 'Assessment (questions without answers)' }, 200: { description: 'Existing in-progress assessment' } },
      },
    },
    '/api/assessment/{id}/submit': {
      post: {
        tags: ['Assessment'],
        summary: 'Submit answers — server-side scoring → competency update → gaps → recommendations',
        security,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AssessmentSubmitRequest' } } } },
        responses: { 200: { description: 'Score + per-competency results' }, 400: { description: 'Expired/already submitted' } },
      },
    },
    '/api/assessment/history/me': { get: { tags: ['Assessment'], summary: 'Assessment history', security, responses: { 200: { description: 'Attempts' } } } },
    '/api/skill-gaps/me': { get: { tags: ['Skill Gaps'], summary: 'Current skill-gap snapshot', security, responses: { 200: { description: 'Skill gaps with priority' } } } },
    '/api/recommendations': {
      get: { tags: ['Recommendations'], summary: 'Stored hybrid recommendations', security, responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/RecommendationsResponse' } } } } } },
    },
    '/api/recommendations/top': { get: { tags: ['Recommendations'], summary: 'Top N (lazy refresh if empty)', security, responses: { 200: { description: 'OK' } } } },
    '/api/recommendations/for-skill/{skillId}': {
      get: { tags: ['Recommendations'], summary: 'Recommendations for one skill', security, parameters: [{ name: 'skillId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' }, 404: { description: 'Unknown skill' } } },
    },
    '/api/recommendations/refresh': {
      post: {
        tags: ['Recommendations'],
        summary: 'Re-run the hybrid pipeline (async by default; ?sync=true for inline)',
        security,
        responses: { 202: { description: 'Queued' }, 200: { description: 'Sync result' } },
      },
    },
    '/api/recommendations/{id}/dismiss': {
      put: { tags: ['Recommendations'], summary: 'Dismiss a recommendation', security, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Dismissed' } } },
    },
    '/api/courses': {
      get: {
        tags: ['Courses'],
        summary: 'List courses (filter/sort/paginate)',
        security: [],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'sort', in: 'query', schema: { type: 'string', example: 'createdAt' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'level', in: 'query', schema: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] } },
          { name: 'skill', in: 'query', schema: { type: 'string' } },
          { name: 'provider', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/courses/{id}': { get: { tags: ['Courses'], summary: 'Course detail', security: [], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' }, 404: { description: 'Not found' } } } },
    '/api/courses/search': { get: { tags: ['Courses'], summary: 'Keyword search (+ ?semantic=true re-ranking)', security: [], parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/api/courses/category/{category}': { get: { tags: ['Courses'], summary: 'Courses by category', security: [], parameters: [{ name: 'category', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/api/courses/skill/{skill}': { get: { tags: ['Courses'], summary: 'Courses by skill (competency code)', security: [], parameters: [{ name: 'skill', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/api/learning/enroll/{courseId}': { post: { tags: ['Learning'], summary: 'Enroll in a course', security, parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'Enrolled' }, 200: { description: 'Already enrolled' } } } },
    '/api/learning/my-courses': { get: { tags: ['Learning'], summary: 'My enrollments', security, responses: { 200: { description: 'OK' } } } },
    '/api/learning/{courseId}/progress': {
      get: { tags: ['Learning'], summary: 'Course progress', security, parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' }, 404: { description: 'Not enrolled' } } },
      put: {
        tags: ['Learning'],
        summary: 'Update progress (module complete / time spent)',
        security,
        parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { moduleIndex: { type: 'integer' }, timeSpentMinutes: { type: 'integer' }, currentModule: { type: 'integer' } } } } } },
        responses: { 200: { description: 'OK (awards LESSON_COMPLETED XP)' } },
      },
    },
    '/api/learning/{courseId}/complete': { post: { tags: ['Learning'], summary: 'Complete course (XP + competency bump + rec refresh)', security, parameters: [{ name: 'courseId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/api/learning/paths/generate': { post: { tags: ['Learning'], summary: 'Generate a personalized learning path', security, responses: { 201: { description: 'Path created' } } } },
    '/api/learning/paths/active': { get: { tags: ['Learning'], summary: 'Active learning path', security, responses: { 200: { description: 'Path' } } } },
    '/api/quizzes': { get: { tags: ['Quizzes'], summary: 'Published quizzes', security: [], responses: { 200: { description: 'OK' } } } },
    '/api/quizzes/{id}': { get: { tags: ['Quizzes'], summary: 'Quiz for taking (answers hidden)', security: [], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' }, 404: { description: 'Not published' } } } },
    '/api/quizzes/{id}/submit': {
      post: {
        tags: ['Quizzes'],
        summary: 'Submit — server-side scoring + competency updates (frontend score never trusted)',
        security,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/QuizSubmitRequest' } } } },
        responses: { 200: { description: 'Score + topic performance + competency updates' }, 403: { description: 'Not published' } },
      },
    },
    '/api/materials/upload': {
      post: {
        tags: ['Materials'],
        summary: 'Upload learning material (PDF/DOCX/PPTX/TXT, validated; async extraction+chunking+embedding)',
        security,
        requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, title: { type: 'string' }, description: { type: 'string' }, tags: { type: 'string' } } } } } },
        responses: { 202: { description: 'Processing started' }, 400: { description: 'Invalid file' } },
      },
    },
    '/api/streak': { get: { tags: ['Gamification'], summary: 'Learning streak', security, responses: { 200: { description: 'OK' } } } },
    '/api/achievements': { get: { tags: ['Gamification'], summary: 'Achievement catalogue', security, responses: { 200: { description: 'OK' } } } },
    '/api/achievements/me': { get: { tags: ['Gamification'], summary: 'My achievements + progress', security, responses: { 200: { description: 'OK' } } } },
    '/api/learning/activity': { get: { tags: ['Gamification'], summary: 'Learning activity feed', security, responses: { 200: { description: 'OK' } } } },
    '/api/communities': {
      get: { tags: ['Community'], summary: 'List communities', security, responses: { 200: { description: 'OK' } } },
      post: { tags: ['Community'], summary: 'Create community', security, responses: { 201: { description: 'Created' } } },
    },
    '/api/communities/{id}/join': { post: { tags: ['Community'], summary: 'Join', security, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Joined' } } } },
    '/api/communities/{id}/leave': { post: { tags: ['Community'], summary: 'Leave', security, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Left' } } } },
    '/api/communities/{id}/messages': {
      get: { tags: ['Community'], summary: 'Recent messages (members only; realtime via Firebase)', security, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' }, 403: { description: 'Not a member' } } },
      post: { tags: ['Community'], summary: 'Send message', security, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'Sent' } } },
    },
    '/api/notifications': { get: { tags: ['Notifications'], summary: 'List notifications', security, responses: { 200: { description: 'OK' } } } },
    '/api/notifications/{id}/read': { put: { tags: ['Notifications'], summary: 'Mark read', security, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/api/notifications/read-all': { put: { tags: ['Notifications'], summary: 'Mark all read', security, responses: { 200: { description: 'OK' } } } },
    '/api/ai/chat': {
      post: {
        tags: ['AI'],
        summary: 'AI assistant — grounded in your profile, gaps, path, quizzes',
        security,
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatRequest' } } } },
        responses: { 200: { description: 'Reply (degrades gracefully to deterministic summary)' } },
      },
    },
    '/api/ai/status': { get: { tags: ['AI'], summary: 'AI provider + feature status', security, responses: { 200: { description: 'OK' } } } },
    '/api/ai/study-plan': { post: { tags: ['AI'], summary: 'Generate a study plan from top gaps', security, responses: { 200: { description: 'OK' } } } },
    '/api/trainer/materials': { get: { tags: ['Trainer'], summary: 'My materials', security, responses: { 200: { description: 'OK' } } } },
    '/api/trainer/quizzes/generate': { post: { tags: ['Trainer'], summary: 'AI MCQ generation from material/topic (zod-validated)', security, responses: { 201: { description: 'Draft quiz' }, 503: { description: 'AI unavailable and no fallback' } } } },
    '/api/trainer/quizzes': { get: { tags: ['Trainer'], summary: 'My quizzes', security, responses: { 200: { description: 'OK' } } } },
    '/api/trainer/quizzes/{id}': { put: { tags: ['Trainer'], summary: 'Edit draft quiz (review generated questions)', security, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/api/trainer/quizzes/{id}/publish': { post: { tags: ['Trainer'], summary: 'Publish (validation must pass)', security, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Published' }, 400: { description: 'Validation issues' } } } },
    '/api/trainer/learners': { get: { tags: ['Trainer'], summary: 'Learner performance on my quizzes', security, responses: { 200: { description: 'OK' } } } },
    '/api/trainer/analytics': { get: { tags: ['Trainer'], summary: 'Quiz + topic-weakness analytics', security, responses: { 200: { description: 'OK' } } } },
    '/api/admin/dashboard': { get: { tags: ['Admin'], summary: 'Platform analytics dashboard', security, responses: { 200: { description: 'OK' } } } },
    '/api/admin/users': { get: { tags: ['Admin'], summary: 'User management list', security, responses: { 200: { description: 'OK' } } } },
    '/api/admin/competencies': { get: { tags: ['Admin'], summary: 'Competency framework', security, responses: { 200: { description: 'OK' } } } },
    '/api/admin/skill-gaps': { get: { tags: ['Admin'], summary: 'Aggregated workforce gaps', security, responses: { 200: { description: 'OK' } } } },
    '/api/admin/courses': {
      get: { tags: ['Admin'], summary: 'Course management list', security, responses: { 200: { description: 'OK' } } },
      post: { tags: ['Admin'], summary: 'Create course', security, responses: { 201: { description: 'Created' } } },
    },
    '/api/admin/courses/{id}': { put: { tags: ['Admin'], summary: 'Update course (re-embeds)', security, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
    '/api/admin/course-sync': { post: { tags: ['Admin'], summary: 'Trigger provider sync (fetch→validate→normalize→dedupe→embed)', security, responses: { 200: { description: 'Sync report' } } } },
    '/api/admin/audit-logs': { get: { tags: ['Admin'], summary: 'Audit log', security, responses: { 200: { description: 'OK' } } } },
    '/api/admin/analytics': { get: { tags: ['Admin'], summary: 'Detailed analytics', security, responses: { 200: { description: 'OK' } } } },
    '/api/search': { get: { tags: ['Search'], summary: 'Global search (courses/skills/communities/paths/quizzes; ?semantic=true)', security: [], parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } } },
  },
} as const;
