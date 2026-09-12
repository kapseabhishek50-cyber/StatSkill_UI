import { ICourse } from '../../models/Course';
import { CourseEmbedding } from '../../models/CourseEmbedding';
import { UserProfileEmbedding } from '../../models/UserProfileEmbedding';
import { getEmbeddingProvider } from '../../ai/embeddings/embedding.service';
import { ISkillGap } from '../../models/SkillGap';
import { IUser } from '../../models/User';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

const log = logger;

/** §11: course embedding text = title + description + skills + category + tags + objectives. */
export const buildCourseEmbeddingText = (course: ICourse): string =>
  [
    course.title,
    course.description,
    course.category,
    course.level,
    `skills: ${course.skills.join(', ')}`,
    `tags: ${course.tags.join(', ')}`,
    `objectives: ${course.learningObjectives.join('; ')}`,
  ]
    .filter(Boolean)
    .join('\n');

export const hashText = (text: string): string => crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);

/** Generates/refreshes the stored embedding for one course (skips when unchanged). */
export const ensureCourseEmbedding = async (course: ICourse, force = false): Promise<void> => {
  try {
    const text = buildCourseEmbeddingText(course);
    const textHash = hashText(text);
    const provider = getEmbeddingProvider();
    const existing = await CourseEmbedding.findOne({ courseId: course._id });
    if (!force && existing && existing.textHash === textHash && existing.provider === provider.name) return;
    const vector = await provider.embed(text);
    await CourseEmbedding.findOneAndUpdate(
      { courseId: course._id },
      {
        provider: provider.name,
        embeddingModel: provider.model,
        dim: vector.length,
        vector,
        textHash,
        sourceText: text.slice(0, 5000),
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Embedding failure must never break course sync (prompt §41/§42).
    log.warn({ err: (err as Error).message, courseId: String(course._id) }, 'course embedding failed');
  }
};

/** §11: learner profile text = role + department + skill gaps + interests + completed courses + goals. */
export const buildUserProfileText = (
  user: Pick<IUser, 'name' | 'designation' | 'department' | 'organization' | 'interests' | 'learningGoals' | 'experience'>,
  gaps: Pick<ISkillGap, 'competencyName' | 'currentScore' | 'requiredScore' | 'gap' | 'priority'>[],
  completedCourseTitles: string[]
): string => {
  const roleLine = `Role: ${user.designation ?? 'Officer'}${user.department ? ` in ${user.department}` : ''}${user.organization ? ` at ${user.organization}` : ''}. Experience: ${user.experience ?? 0} years.`;
  const gapLine = gaps.length
    ? `Priority skill gaps (needs training): ${gaps
        .slice(0, 8)
        .map((g) => `${g.competencyName} (current ${g.currentScore}%, required ${g.requiredScore}%, gap ${g.gap})`)
        .join('; ')}.`
    : 'No open skill gaps.';
  const interestLine = user.interests?.length ? `Interests: ${user.interests.join(', ')}.` : '';
  const goalLine = user.learningGoals?.length ? `Learning goals: ${user.learningGoals.join(', ')}.` : '';
  const historyLine = completedCourseTitles.length
    ? `Completed courses: ${completedCourseTitles.slice(0, 10).join(', ')}.`
    : '';
  return [roleLine, gapLine, interestLine, goalLine, historyLine].filter(Boolean).join('\n');
};

/** Computes (and caches) the learner profile embedding. */
export const getUserProfileEmbedding = async (
  user: IUser,
  gaps: ISkillGap[],
  completedCourseTitles: string[],
  force = false
): Promise<number[] | null> => {
  try {
    const text = buildUserProfileText(user, gaps, completedCourseTitles);
    const textHash = hashText(text);
    const provider = getEmbeddingProvider();
    if (!force) {
      const cached = await UserProfileEmbedding.findOne({ userId: user._id });
      if (cached && cached.textHash === textHash && cached.provider === provider.name) return cached.vector;
    }
    const vector = await provider.embed(text);
    await UserProfileEmbedding.findOneAndUpdate(
      { userId: user._id },
      { provider: provider.name, embeddingModel: provider.model, dim: vector.length, vector, textHash, sourceText: text.slice(0, 5000) },
      { upsert: true, new: true }
    );
    return vector;
  } catch (err) {
    log.warn({ err: (err as Error).message, userId: String(user._id) }, 'user profile embedding failed');
    return null;
  }
};

/** Batch loads stored course vectors. Returns Map<courseId, vector>. */
export const loadCourseVectors = async (courseIds: string[]): Promise<Map<string, number[]>> => {
  const docs = await CourseEmbedding.find({ courseId: { $in: courseIds } });
  return new Map(docs.map((d) => [String(d.courseId), d.vector]));
};
