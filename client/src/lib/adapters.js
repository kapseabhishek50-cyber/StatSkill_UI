/**
 * Shape adapters between the API (0-100 scores, UPPER_CASE enums) and the UI
 * (0-5 levels, lowercase bands). All conversions live here so pages stay
 * declarative and no page invents its own arithmetic.
 */

/** 0-100 score → 0-5 display level. */
export function scoreToLevel(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n / 20)));
}

/** CRITICAL|HIGH|MEDIUM|LOW → critical|high|moderate|low. */
export function priorityToBand(priority) {
  const p = String(priority ?? '').toUpperCase();
  if (p === 'CRITICAL') return 'critical';
  if (p === 'HIGH') return 'high';
  if (p === 'MEDIUM') return 'moderate';
  return 'low';
}

/**
 * Skill-gap row → dashboard gap row.
 * `mandatoryIds` is the set of competency ids the officer's role marks core.
 */
export function gapToRow(gap, mandatoryIds = new Set()) {
  const currentLevel = scoreToLevel(gap.currentScore);
  const requiredLevel = scoreToLevel(gap.requiredScore);
  const id = String(gap.competencyId ?? gap.competency?.id ?? gap.competency?._id ?? '');
  return {
    competencyId: id,
    name: gap.competencyName ?? gap.competency?.name ?? gap.skillName ?? 'Competency',
    competency: gap.competency ?? { _id: gap.competencyId, name: gap.competencyName },
    mandatory: mandatoryIds.has(id),
    currentLevel,
    requiredLevel,
    gap: Math.max(0, requiredLevel - currentLevel),
    gapPoints: gap.gap ?? 0,
    band: priorityToBand(gap.priority),
    currentScore: gap.currentScore,
    requiredScore: gap.requiredScore,
  };
}

/** Share of required scores already closed, 0..1. */
export function readinessFromGaps(gaps) {
  const rows = (gaps ?? []).filter((g) => Number(g.requiredScore) > 0);
  if (!rows.length) return 1;
  const required = rows.reduce((sum, g) => sum + Number(g.requiredScore), 0);
  const missing = rows.reduce((sum, g) => sum + Math.max(0, Number(g.gap ?? 0)), 0);
  return Math.max(0, Math.min(1, 1 - missing / required));
}

/**
 * Deterministic narrative from computed gaps — the same numbers the charts
 * show, in sentence form. Not model output, so it never hallucinates.
 */
export function narrativeFromGaps(gaps) {
  const open = (gaps ?? []).filter((g) => Number(g.gap) > 0);
  if (!open.length) {
    return {
      summary: 'You meet every measured requirement for your role. Keep the streak alive to stay sharp.',
      factors: [],
    };
  }
  const [top, ...rest] = open;
  const topName = top.competencyName ?? top.skillName ?? 'your top gap';
  const summary =
    `Your widest open gap is ${topName} — ${top.currentScore}% against a ${top.requiredScore}% role requirement. ` +
    `Closing it first moves your readiness the most.`;
  const factors = open.slice(0, 3).map((g) => {
    const name = g.competencyName ?? g.skillName ?? 'gap';
    return `${name}: ${g.gap} points to close (${String(g.priority ?? '').toLowerCase()} priority)`;
  });
  void rest;
  return { summary, factors };
}

/** Flat course recommendations → per-competency learning-path steps. */
export function recommendationsToPath(recommendations, gapsByCode = new Map()) {
  const groups = new Map();
  for (const rec of recommendations ?? []) {
    const code = String(rec.skillCode ?? rec.competencyId ?? '');
    if (!code) continue;
    if (!groups.has(code)) {
      const gap = gapsByCode.get(code);
      groups.set(code, {
        competencyId: String(rec.competencyId ?? code),
        code,
        competency: { name: rec.skillName ?? rec.skill ?? 'Competency' },
        band: priorityToBand(rec.priority),
        currentLevel: gap ? scoreToLevel(gap.currentScore) : 0,
        requiredLevel: gap ? scoreToLevel(gap.requiredScore) : 0,
        explanation: rec.reason ?? '',
        courses: [],
      });
    }
    const step = groups.get(code);
    if (!step.explanation && rec.reason) step.explanation = rec.reason;
    step.courses.push({
      courseDetail: { title: rec.title ?? 'Course', externalUrl: rec.url ?? '#' },
      provider: rec.provider,
      matchScore: rec.matchScore,
    });
  }
  return [...groups.values()];
}

/** Published quiz → QuizRunner attempt shape. */
export function quizToAttempt(quiz) {
  return {
    quizId: String(quiz._id ?? quiz.id),
    title: quiz.title,
    competency: { name: quiz.title },
    durationMinutes: quiz.durationMinutes,
    questions: (quiz.questions ?? []).map((q) => ({
      _id: q.questionId,
      stem: q.question,
      topic: q.topic,
      options: (q.options ?? []).map((text, i) => ({ _id: String(i), text })),
    })),
  };
}

/** Quiz submit response → QuizResult shape. */
export function quizSubmitToResult(payload) {
  const updates = payload?.competencyUpdates ?? [];
  const first = updates[0];
  return {
    scoreRatio: payload?.scoreRatio ?? (payload?.attempt ? payload.attempt.score / 100 : 0),
    scorePct: payload?.attempt?.score ?? Math.round((payload?.scoreRatio ?? 0) * 100),
    passed: payload?.passed ?? false,
    levelBefore: first ? scoreToLevel(first.from) : null,
    levelAfter: first ? scoreToLevel(first.to) : null,
    xpAwarded: payload?.attempt?.xpAwarded ?? 0,
    competencyUpdates: updates,
    answers: (payload?.review ?? []).map((r) => ({
      question: r.questionId,
      stem: r.stem,
      topic: r.topic,
      chosen: r.chosenText ?? (r.chosen === null || r.chosen === undefined ? 'no answer' : String(r.chosen)),
      correct: r.correctText ?? String(r.correct ?? ''),
      isCorrect: r.isCorrect,
      explanation: r.explanation,
    })),
    feedback: null,
  };
}

/** Attempt history row → past-attempt table row. */
export function attemptToRow(attempt) {
  const score = Number(attempt.score ?? 0);
  return {
    _id: attempt._id,
    competency: { name: attempt.quizId?.title ?? attempt.quizTitle ?? 'Quiz' },
    quizTitle: attempt.quizId?.title ?? attempt.quizTitle ?? 'Quiz',
    targetLevel: null,
    scoreRatio: score / 100,
    scorePct: score,
    passed: score >= 70,
    correctAnswers: attempt.correctAnswers,
    totalQuestions: attempt.totalQuestions,
    createdAt: attempt.submittedAt ?? attempt.createdAt,
  };
}

const AI_PREFIX = '🤖 AI Co-pilot';

/** Community message → discussion bubble (detects persisted AI replies). */
export function normalizeMessage(message) {
  const raw = message?.content ?? '';
  const isAi = message?.isAiGenerated === true || raw.startsWith('🤖');
  let content = raw;
  if (raw.startsWith(AI_PREFIX)) {
    const cut = raw.indexOf('\n\n');
    content = cut >= 0 ? raw.slice(cut + 2) : raw;
  }
  const author = message?.userId && typeof message.userId === 'object' ? message.userId : null;
  return {
    _id: message?._id,
    content,
    createdAt: message?.createdAt,
    isAiGenerated: isAi,
    isPinned: false,
    helpfulCount: 0,
    authorName: isAi ? 'StatSkill AI' : (author?.name ?? 'Member'),
    authorRole: author?.designation ?? '',
    replyToId: message?.replyToId,
  };
}

/** Community → discussion group card. */
export function communityToGroup(community) {
  return {
    _id: community?._id,
    title: community?.name ?? 'Community',
    topic: community?.description ?? '',
    memberCount: community?.membersCount ?? 0,
    category: community?.category ?? '',
    isMember: community?.isMember,
  };
}

/** Enrollment → MyLearning card + stats. */
export function enrollmentToItem(enrollment) {
  const course = enrollment?.courseId && typeof enrollment.courseId === 'object' ? enrollment.courseId : {};
  return {
    _id: enrollment?._id,
    status: String(enrollment?.status ?? '').toLowerCase() === 'completed' ? 'completed' : 'in_progress',
    progressPct: enrollment?.progress ?? 0,
    timeSpentMinutes: enrollment?.timeSpentMinutes ?? 0,
    course: {
      _id: course._id,
      title: course.title ?? 'Course',
      provider: course.provider ?? 'NSSTA',
      durationHours: course.durationHours ?? 4,
      externalUrl: course.url ?? '#',
      imageUrl: course.thumbnail ?? null,
      category: course.category,
      level: course.level,
    },
  };
}

export function enrollmentStats(items) {
  const list = items ?? [];
  const completed = list.filter((e) => e.status === 'completed').length;
  const minutes = list.reduce((sum, e) => sum + Number(e.timeSpentMinutes ?? 0), 0);
  return {
    total: list.length,
    completed,
    inProgress: list.length - completed,
    totalHours: Math.round((minutes / 60) * 10) / 10,
  };
}

/** Aggregate gap row → GapBarChart row. */
export function topGapToRow(entry) {
  return {
    name: entry.competencyName ?? entry._id,
    priorityScore: Number(entry.avgGap ?? 0),
    gap: Number(entry.avgGap ?? 0),
    currentLevel: scoreToLevel(entry.avgCurrent),
    requiredLevel: scoreToLevel(entry.avgRequired),
    affectedUsers: entry.affectedUsers ?? 0,
    criticalCount: entry.criticalCount ?? 0,
  };
}

/** Learning activity → 60-day heatmap cells. */
export function activityToHeatmap(activities, days = 60) {
  const byDay = new Map();
  for (const activity of activities ?? []) {
    const date = new Date(activity.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const cells = [];
  const today = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    cells.push({ day: key, active: byDay.has(key), count: byDay.get(key) ?? 0 });
  }
  return cells;
}

/** Achievement catalogue + unlocks → badge grid. */
export function achievementsToBadges(all, unlockedIds) {
  const unlocked = new Set((unlockedIds ?? []).map((a) => String(a.achievementId?._id ?? a.achievementId ?? a.code ?? a._id)));
  const ruleText = (rule) => {
    if (!rule) return '';
    const n = rule.threshold ?? 1;
    const what = String(rule.type ?? '').toLowerCase().replace(/_/g, ' ');
    return `Requirement: ${n} ${what}`;
  };
  return (all ?? []).map((a) => {
    const id = String(a._id ?? a.code);
    const isUnlocked = unlocked.has(id) || unlocked.has(String(a.code));
    return {
      id,
      title: a.title ?? a.code,
      desc: a.description ?? '',
      icon: a.icon ?? '🏅',
      xpReward: a.xpReward ?? 0,
      unlocked: isUnlocked,
      req: isUnlocked ? null : ruleText(a.rule),
    };
  });
}

/** Material → trainer material row. */
export function materialToRow(material) {
  return {
    _id: material?._id,
    title: material?.title ?? 'Material',
    fileType: material?.fileType ?? '',
    textLength: material?.extractedChars ?? 0,
    status: material?.status ?? '',
    chunkCount: material?.chunkCount ?? 0,
    createdAt: material?.createdAt,
  };
}
