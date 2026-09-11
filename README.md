# StatSkill AI

Competency-based workforce upskilling for the Indian official statistical system —
MoSPI, the NSO, and State Directorates of Economics & Statistics.

An officer's learning path is **computed**, not curated. The platform records what
level a role requires, measures what level the officer holds, and derives the gap,
the priority, the courses and the quiz from that arithmetic. Every number a learner
or an administrator sees can be traced back to the two levels it came from.

```
LEARNER   Profile → Assessment → Skill gap → Learning path → iGOT / NSSTA
                        ↑                                          ↓
             Competency updated ← Feedback ← Evaluation ← Quiz ← Learning

ADMIN     Analytics → Division × competency heatmap → Ranked workforce gaps
```

The arrow back from *Competency updated* to *Assessment* is the point of the system:
a quiz pass rewrites the officer's recorded level, which changes the gap, which
changes the next recommendation. It is a loop, not a funnel.

---

## Run it

Requirements: Node ≥ 20.11 and a MongoDB you can reach (local `mongod` is fine).

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

The client is served at http://localhost:5173 and proxies `/api` to the server on
port 4000. `npm run seed` resets the database and loads the framework, a catalogue,
and 38 accounts.

**Sign in:**

| Role    | Email                    | Password      |
| ------- | ------------------------ | ------------- |
| Officer | `officer@mospi.gov.in`   | `Officer@123` |
| Admin   | `admin@mospi.gov.in`     | `Admin@123`   |

Both are one-click buttons on the sign-in screen.

### Without an API key

Leave `ANTHROPIC_API_KEY` empty and everything still works end to end. A
deterministic offline provider stands in for the model, and every generated
response is tagged in the UI with its source — `live`, `cache`, or `mock` — so
nobody has to guess which they are looking at. `GET /api/health` names the provider
in use.

### Live Google assistant

The learner assistant can use Google's Gemini free tier. Create a key at
https://aistudio.google.com/apikey and add it to the root `.env` file:

```bash
GOOGLE_GEMINI_API_KEY=your-key-here
GOOGLE_GEMINI_MODEL=gemini-3.6-flash
```

The key stays on the server. Gemini receives the learner's current role,
computed gaps, recorded levels, extracted profile evidence, and recent quiz
results, so answers are grounded in that learner. `/api/health` reports
`google-gemini` when the key is active. If the key is absent or unavailable,
the context-aware local fallback answers instead.

### No MongoDB? Two escape hatches

- `npm run dev:mongo` boots a real, ephemeral `mongod` on
  `mongodb://127.0.0.1:27017` (binary fetched on first run). Follow with
  `npm run seed` as usual. If the binary cannot be downloaded (restricted
  sandboxes), the same command automatically falls back to a SQLite-backed
  MongoDB-compatible server — the API cannot tell the difference, and its
  data persists in `server/.dev-data/` across restarts.
- The API also boots *degraded* in development when the database is down: the
  health endpoint reports it, live data routes answer with the seed snapshot,
  and a background retry heals the connection the moment MongoDB appears.

---

## The public website is dynamic

The landing page at `/foldcraft` (the default destination for signed-out
visitors) is not a static brochure:

- `GET /api/stats/public` returns the platform's live counts — officers,
  competencies, courses, quizzes, communities — straight from MongoDB, plus the
  competency names the ticker slides past. No auth; safe for a public page.
- The page refetches every 60 seconds. A green **LIVE** pill means the numbers
  on screen are database counts; an amber **Demo snapshot** pill means the API
  is unreachable and the bundled seed snapshot is shown instead. It never
  claims to be live when it isn't.
- Motion is layered, not decorative-only: a WebGL (three.js) hero scene with
  pointer parallax and scroll drift, mouse-tracking 3D tilt cards with glare,
  scroll-progress bars, IntersectionObserver reveals, parallax sections,
  count-up statistics and a scroll-driven timeline. Everything respects
  `prefers-reduced-motion`, pauses off-screen, and the 3D engine ships in a
  lazy chunk so authenticated users never download it.

The reusable effects live in `client/src/components/fx/` (`Reveal`, `CountUp`,
`Tilt3DCard`, `ScrollProgress`, `Parallax`, `Marquee`, `Hero3DScene`) and are
used by the app pages too — the learner dashboard tiles count up and tilt, and
a progress line runs across the top of the app shell.

---

## How the numbers work

Two formulas, both visible in the interface rather than asserted in a slide.

**Gap.** The difference between the level the role requires and the level the
officer holds, normalised onto 0..1 by the height of the scale:

```
gap = max(0, requiredLevel − currentLevel) / MAX_LEVEL
```

**Priority.** The gap acts as a multiplicative gate — no gap, no recommendation,
whatever the context — and the three context factors are a *weighted sum* whose
weights total 1, so priority stays inside 0..1 and remains comparable across roles
and divisions:

```
priority = gap × (0.5 × roleImportance + 0.2 × departmentPriority + 0.3 × futureDemand)
```

The weighted sum is deliberate. A pure product (`gap × importance × priority ×
demand`) collapses to zero the moment any single factor is zero, so one division
recorded at priority 0 would silently erase every genuine gap its officers have.
Weights live in [`server/src/config/competency.js`](server/src/config/competency.js)
and are validated at import to sum to 1.

Priority bands (`critical ≥ 0.5`, `high ≥ 0.3`, `moderate ≥ 0.15`) are fixed
thresholds, not per-user percentiles, so "critical" means the same thing for every
officer. `GET /api/scale` publishes the scale, the bands and the pass mark, which is
what lets a learner check a score rather than take it on trust.

### Evidence, not self-belief

A recorded level carries how it was established, and a stronger source is never
overwritten by a weaker one:

```
self_reported  <  assessment  <  quiz  <  admin_override
```

A passed quiz (≥ 70%) raises the level and is recorded as `quiz` evidence. A failed
quiz writes nothing at all — a fail is evidence of an unproven level, not of a lower
one, and demoting someone for attempting a test would teach them not to attempt it.
Completing a course does not raise a level either: attendance is not evidence.

---

## Where the model is used, and where it is not

The LLM does five jobs, each behind [`server/src/services/llm/`](server/src/services/llm/):
skill extraction from an uploaded CV, the plain-English explanation of a computed
path, MCQ generation, quiz feedback, and course-match phrasing.

It does **none** of these: computing a gap, ranking a priority, scoring a quiz,
deciding a pass, or writing a competency level. Those are arithmetic, and arithmetic
that a court of enquiry might one day ask about should not be a sampled token.

Generated MCQs are gated by a **mechanical** validator
([`mcqValidator.js`](server/src/services/mcqValidator.js)) before they can ever be
served — exactly one correct option, no answer leakage into the stem, no
near-duplicate distractors, no filler options, an explanation present, no answer
conspicuously longer than its distractors. Rejected items are stored with their
reasons rather than discarded, so a bad batch is visible instead of invisible. No
model sits in that loop; a generator cannot be the judge of its own output.

---

## Layout

```
server/src
  config/       env, db, and the competency scale + weights (change them here only)
  models/       Mongoose schemas — the framework, the levels, the audit trail
  services/
    gapEngine.js        gap + priority arithmetic (pure, unit-tested)
    recommender.js      course matching by tag overlap × level fit
    learningPath.js     the pipeline in one place, so two routes cannot disagree
    assessmentScoring.js evidence precedence and level recording
    mcqValidator.js     deterministic quiz-item checks
    workforce.js        admin roll-up, reusing the learner's own gap engine
    llm/                provider seam: live, cache, mock — swappable, never imported directly
  routes/       the API surface, mounted in one place
  seed/         framework, catalogue and a demo workforce

client/src
  pages/        learner flow (Profile → Assessment → Path → Learning → Quiz) and admin analytics
  components/   charts, competency widgets, layout
  lib/api.js    one endpoint map mirroring the server's routes
```

The admin dashboard calls the same `computeGaps` the learner's own path does. A
dashboard with its own copy of the formula is a dashboard that will eventually
disagree with the officer it describes.

---

## Access control

JWT authentication is not authorisation. Every admin route is guarded server-side by
`requireRole('admin')` — hiding a menu item in the client is not access control —
and every read of workforce competency data is written to a capped `AuditLog`. A
read of personnel data that leaves no trace is not one an officer can later ask
about.

Uploads are held in memory only (`multer.memoryStorage`): there is no upload
directory to traverse, fill, or leak. Text is extracted once at upload, so no read
path re-parses a file.

---

## Tests

```bash
npm test --workspace server
```

22 tests covering the gap and priority arithmetic (including the zero-factor case a
product formula gets wrong), the MCQ validator's rejection rules, and the offline
provider's contract.

---

## Deliberate limits

Worth stating plainly rather than discovering during questions.

- **Course matching is tag overlap × level fit, not embeddings.** The seam is named
  (`semanticScores` in the recommender) and a vector store drops in behind it
  without touching a route. Tags are honest for a 23-course catalogue; they will not
  scale to thousands.
- **The heatmap's officer levels are seeded from per-division profiles**, not real
  personnel data. The structure is synthetic; the arithmetic over it is not.
- **Document extraction expects a text-bearing PDF or DOCX.** A scanned image needs
  OCR first, and the API says so rather than silently returning nothing.
- **Single-node, single-tenant.** No SSO against government identity, no eOffice
  integration, no state-level tenancy.
