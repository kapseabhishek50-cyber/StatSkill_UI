# StatSkill AI — Backend

Production-ready REST API for **StatSkill AI**, an AI-powered learning & competency
platform for India's Official Statistical System (MoSPI / NSSTA / iGOT). This package
is backend-only and is consumable by any frontend client (the React client lives in
`../client`).

## Quick start

```bash
npm install
cp .env.example .env        # optional — everything works with zero keys
npm run seed                # demo data (development only)
npm run dev                 # http://localhost:5000  (docs: /api/docs)
```

**Zero-config guarantee:** with no API keys and no MongoDB, the platform still runs
end-to-end — an embedded dev database boots automatically (in-memory mongod, with a
bundled SQLite-backed EasyDB fallback), the LLM defaults to a deterministic mock,
and embeddings use a local hashed n-gram provider.

**Demo logins** (created by `npm run seed`, dev only): `rahul.sharma@mospi.gov.in`,
`priya.nair@nssta.gov.in` (trainer), `admin@mospi.gov.in` (admin) — password `Demo@123`.

> **Note for the bundled React client:** `client/` proxies `/api` to port **4000**;
> this server defaults to **5000**. Point the client proxy (or `PORT`) accordingly.

## Architecture

```
Controller → Service → (AIProvider | CourseProvider | Repos)
```

- **Controllers** (`src/controllers`) — HTTP shape only; no business logic, no AI calls.
- **Services** (`src/services`) — all domain logic, deterministic and unit-testable.
- **AI providers** (`src/ai/providers`) — `GeminiProvider`, `OpenAIProvider`,
  `MockProvider` behind one `AIProvider` interface, selected by `AI_PROVIDER`.
  The LLM **explains**; it never ranks, never invents course IDs/URLs/scores.
- **Course providers** (`src/services/provider`) — `CourseProvider` interface with
  IGOT / NSSTA / MoSPI / Mock adapters. A provider activates **only** when both URL
  and API key are configured. No scraping.
- **Background jobs** (`src/jobs`) — course sync, embedding refresh, recommendation
  refresh, notification fan-out. Embeddings are generated/updated by jobs, never
  per-request (Redis/BullMQ when `REDIS_URL` is set, in-process otherwise).

### Hybrid recommendation engine

`score = w_gap·gap + w_role·roleFit + w_sem·semantic + w_diff·difficulty
       + w_hist·history + w_pop·popularity + w_fresh·freshness`

Default weights: `0.35 / 0.20 / 0.20 / 0.10 / 0.05 / 0.05 / 0.05` — configurable via
`REC_WEIGHT_*` env. Gap priorities: `≥40 CRITICAL, ≥25 HIGH, ≥10 MEDIUM, else LOW`
(configurable). `matchScore = round(final × 100)`. The optional LLM only writes a
human-readable `reason` for backend-supplied candidates.

### Deterministic backend owns

Competency scores, quiz scores (never trusted from the client), course IDs and
availability, permissions, streaks (login is not an activity), XP, achievements,
enrollment, official data, and recommendation eligibility.

## API surface (all under `/api`)

| Area | Endpoints |
| --- | --- |
| Auth | `auth/{register,login,refresh,logout,me,password}` (JWT access+refresh, rotation with replay detection) |
| Dashboard | `GET dashboard` — one-shot aggregation |
| Profile | `profile/{me GET/PUT, learning-profile}` |
| Assessment | `assessment/{start, :id/submit, :id, history/me}` (90-min TTL, gap-driven selection) |
| Competencies | `competencies{,/roles,/me}`, `skill-gaps/me` |
| Recommendations | `recommendations{,/top,/for-skill/:skillId,/refresh,/:id/dismiss}` |
| Courses | `courses{,/search,/categories,/category/:c,/skill/:s,:id}` |
| Learning | `learning/{paths,paths/generate,activity,summary,enroll/:courseId,my-courses,:courseId/progress,:courseId/complete,:courseId/timeline}` |
| Materials | `materials/{upload,, :id,:id/chunks,DELETE}` — PDF/DOCX/PPTX/TXT → extract → chunk → embed |
| Quizzes | `quizzes{,/attempts/me,:id,:id/submit}` + trainer generate/review/publish (Zod-validated MCQs; answers never sent to learners; server-side scoring) |
| Gamification | `streak`, `achievements{,/me}` |
| Communities | `communities{,/join,/leave,/members,/messages,/report}` (Firebase optional) |
| Notifications | `notifications{,/read-all,/:id/read}` |
| AI assistant | `ai/{chat,status,test,study-plan}` — grounded in the caller's gaps/courses |
| Trainer | `trainer/*` (TRAINER or ADMIN) |
| Admin | `admin/*` incl. `analytics`, `providers`, `course-sync`, `audit-logs` (ADMIN) |
| Search | `search?q=` — courses/skills/communities/paths/quizzes |
| Health | `health{,/detailed}` |

Conventions: success `{success, data, message}`; errors
`{success:false, message, code, errors[]}`; pagination
`{items, pagination:{page,limit,total,totalPages}}`. OpenAPI document at
`/api/docs.json`, Swagger UI at `/api/docs`, Postman collection in
`docs/postman_collection.json`.

## Configuration

See [.env.example](.env.example). Highlights:

- `AI_PROVIDER=mock|gemini|openai` — mock keeps everything functional with zero keys.
- `EMBEDDING_PROVIDER=local|gemini|openai` — local hashed n-gram vectors by default.
- `REC_WEIGHT_*`, `GAP_*_THRESHOLD` — engine tuning without code changes.
- `IGOT_/NSSTA_/MOSPI_ BASE_URL + API_KEY` — official course providers; active only
  when both values exist.
- `MONGODB_URI` empty in dev/test → embedded database auto-boot.
- Secrets are never returned by the API and `.env` is never committed.

## Tests

```bash
npm test          # full suite (unit + integration + security)
npm run test:unit
```

Covers: gap calculation, recommendation scoring, cosine similarity, competency
updates, streaks, quiz scoring (unit); auth, courses, assessment, recommendations,
quizzes, progress, communities (integration); unauthorized access, role
restrictions, invalid input, upload restrictions (security).

## Database indexes

Hot paths are indexed per spec (users by email, courses by source/externalId and
text-ish fields, skill gaps by user+code, recommendations by user+score, activities
by user+createdAt, notifications by user+isRead, audit logs by createdAt+action).

## Security

Helmet, CORS allow-list, express-rate-limit (stricter on auth), Zod validation on
every mutating route, bcrypt password hashing, JWT rotation + replay detection,
role middleware, upload MIME/extension allow-list, and structured Pino logging with
`requestId`/`userId`/latency that never logs secrets.
