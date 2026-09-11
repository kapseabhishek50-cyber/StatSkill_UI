# StatSkill AI — API Documentation

This document describes all API endpoints for the StatSkill AI platform. All endpoints use JSON format.

## Base URL
- Development: `http://localhost:4000/api`
- Production: `https://statskill-api.gov.in/api`

## Authentication
All protected endpoints require a valid JWT token in the Authorization header:
```bash
Authorization: Bearer <token>
```

Tokens are obtained via `/auth/login` or `/auth/register`.

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Human-readable error description",
  "code": "ERROR_CODE"
}
```

---

## Authentication Endpoints

### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@mospi.gov.in",
  "password": "securePassword"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "id": "...",
      "name": "Rahul Sharma",
      "email": "user@mospi.gov.in",
      "role": "learner",
      "department": "SDRD"
    }
  }
}
```

---

### POST /auth/register
Create a new account.

**Request:**
```json
{
  "name": "Rahul Sharma",
  "email": "user@mospi.gov.in",
  "password": "securePassword",
  "employeeId": "12345",
  "department": "...",
  "jobRole": "..."
}
```

---

### GET /auth/me
Get current user information.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "learner|trainer|admin",
    "department": {...},
    "jobRole": {...},
    "currentStreak": 7,
    "xp": 2480,
    "longestStreak": 21
  }
}
```

---

## Profile Endpoints

### GET /profile/me
Get full user profile.

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "...",
    "email": "...",
    "employeeId": "...",
    "designation": "...",
    "department": {...},
    "role": "...",
    "experience": "5 years",
    "education": "...",
    "currentAssignment": "...",
    "previousTraining": [...],
    "preferredLanguage": "en"
  }
}
```

---

### PUT /profile/me
Update profile.

**Request:** Any subset of profile fields.

---

### POST /profile/me/documents
Upload CV or other documents.

**Request:** `multipart/form-data`
- `file`: Document file (max 10MB, PDF/DOCX only)

---

## Profile Competencies

### GET /profile/me/competencies
Get user's current competency scores.

**Response:**
```json
{
  "success": true,
  "data": {
    "competencies": [
      {
        "skill": "Python",
        "category": "Technical",
        "currentScore": 68,
        "requiredScore": 80,
        "gap": 12,
        "priority": "medium"
      }
    ],
    "overallCompetency": 68
  }
}
```

---

### GET /profile/me/requirements
Get role competency requirements.

---

## Competencies Reference

### GET /competencies
Get all available competencies with descriptions.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Python",
      "category": "Technical",
      "description": "Programming with Python",
      "levels": [
        {"level": 1, "description": "Basics"},
        {"level": 3, "description": "Intermediate"},
        {"level": 5, "description": "Expert"}
      ]
    }
  ]
}
```

---

## Assessment Endpoints

### POST /assessments/start
Begin an assessment based on user's role.

**Response:**
```json
{
  "success": true,
  "data": {
    "assessmentId": "...",
    "questions": [
      {
        "question": "What is stratified sampling?",
        "options": [
          "A random selection of units",
          "Dividing population into strata before sampling",
          "Selecting every 10th unit",
          "None of the above"
        ],
        "correctOption": 1,
        "explanation": "Stratified sampling divides the population..."
      }
    ],
    "difficulty": "medium"
  }
}
```

---

### POST /assessments/submit
Submit assessment answers.

**Request:**
```json
{
  "assessmentId": "...",
  "answers": [
    {"questionId": "...", "selectedOption": 1},
    {"questionId": "...", "selectedOption": 3}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 85,
    "accuracy": 0.85,
    "passed": true,
    "competencyImpact": {
      "Python": { "before": 25, "after": 34, "change": 9 }
    },
    "feedback": "You performed well on sampling concepts..."
  }
}
```

---

## Recommendations

### GET /recommendations/me
Get personalized course recommendations.

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "course": {"id": "...", "title": "Machine Learning"},
        "skill": "AI/ML",
        "matchScore": 94,
        "whyRecommended": "Your AI/ML competency is below required level."
      }
    ],
    "narrative": {
      "summary": "You have 3 open gaps...",
      "priorityActions": ["Complete ML course"]
    }
  }
}
```

---

### POST /recommendations/me/recompute
Force recommendation recalculation.

---

## Quiz Endpoints

### POST /quiz/start
Start a quiz session.

---

### POST /quiz/submit
Submit quiz answers.

**Request:**
```json
{
  "quizId": "...",
  "answers": [{"questionId": "...", "selectedOption": 1}]
}
```

---

### GET /quiz/me
Get quiz history.

---

## Learning Endpoints

### GET /learning/me
Get learning progress.

**Response:**
```json
{
  "success": true,
  "data": {
    "completedCourses": 8,
    "learningHours": 34.5,
    "enrolledCourses": [...],
    "completedCourses": [...]
  }
}
```

---

### POST /learning/enroll
Enrolling in a course.

---

### POST /learning/complete
Mark course complete.

---

## Discussion Endpoints

### GET /discussions/groups
List all discussion groups.

---

### GET /discussions/groups/:id/messages
Get messages for group.

---

### POST /discussions/groups/:id/messages
Post a message.

**Request:**
```json
{"content": "What is stratified sampling?", "replyTo": "..."}
```

---

### POST /discussions/groups/:id/ask-ai
Ask AI assistant within group context.

**Request:**
```json
{"prompt": "Explain regression analysis"}
```

---

## Gamification

### GET /gamification/streak
Streak data.

**Response:**
```json
{
  "success": true,
  "data": {
    "currentStreak": 7,
    "longestStreak": 21,
    "totalLearningDays": 45,
    "lastActivityDate": "2024-01-15",
    "weeklyActivity": [{"day": 1, "minutes": 45}],
    "monthlyActivity": [{"week": 1, "minutes": 120}]
  }
}
```

---

### GET /gamification/leaderboard
Rankings.

---

### GET /gamification/badges
Earned badges.

---

## Trainer Endpoints

### GET /trainer/materials
List uploaded materials.

---

### POST /trainer/upload-material
Upload PDF/DOCX/PPTX/TXT.

---

### POST /trainer/generate-quiz
Generate MCQs from document.

**Request:**
```json
{
  "numberOfQuestions": 5,
  "difficulty": "Medium",
  "language": "English",
  "topic": "Statistical Sampling",
  "material": "..."
}
```

---

### POST /trainer/publish-quiz
Publish to question bank.

---

## Admin Endpoints

### GET /admin/overview
Workforce analytics overview.

**Response:**
```json
{
  "success": true,
  "data": {
    "officers": 150,
    "divisions": 12,
    "meanReadiness": 0.68,
    "officersWithGaps": 45,
    "quizzesTaken": 234,
    "coursesEnrolled": 567,
    "catalogue": 120
  }
}
```

---

### GET /admin/heatmap
Skill heatmap data.

---

### GET /admin/gaps
Gap rankings.

---

### GET /admin/officers
List officers.

---

### GET /admin/courses
Course catalog management.

---

### GET /admin/questions
Question bank.

---

## System Endpoints

### GET /health
Service health status.

**Response:**
```json
{
  "status": "ok",
  "env": "development",
  "time": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": {"status": "connected", "latency": 5},
    "ai": {"status": "connected", "provider": "google-gemini"},
    "igot": {"status": "not_configured"},
    "nssta": {"status": "not_configured"},
    "firebase": {"status": "not_configured"}
  }
}
```

---

## Integration Center

### GET /integrations/status
Admin-only endpoint for integration diagnostics.

Requires `requireAuth` and `requireRole('admin')`.

---

## Error Codes

| Code | Description |
|------|-------------|
| AUTH_REQUIRED | Authentication required |
| INVALID_TOKEN | Token expired or invalid |
| PRIVILEGE_ERROR | Insufficient role permissions |
| COURSE_NOT_FOUND | Course not found |
| QUIZ_SUBMISSION_ERROR | Quiz submission failed |
| AI_GENERATION_ERROR | AI service error |
| INTEGRATION_ERROR | External API failure |
| VALIDATION_ERROR | Invalid input data |
