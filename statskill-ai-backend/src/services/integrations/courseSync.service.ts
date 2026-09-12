import { Course } from '../../models/Course';
import { getProviders } from './index';
import { NormalizedCourse } from './provider.interface';
import { embeddingJob } from '../../jobs/embedding.job';
import { audit } from '../../middleware/audit.middleware';
import { logger } from '../../utils/logger';
import { z } from 'zod';

const log = logger;

/** Validation schema for normalized courses before persistence (prompt §16). */
const normalizedCourseSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  provider: z.string().min(2),
  source: z.enum(['IGOT', 'NSSTA', 'MOSPI', 'INTERNAL', 'MOCK', 'EXTERNAL']),
  externalId: z.string().optional(),
  url: z.string().optional(),
  category: z.string().min(2),
  skills: z.array(z.string()),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  durationHours: z.number().min(0),
  language: z.string(),
  tags: z.array(z.string()),
  learningObjectives: z.array(z.string()),
  eligibility: z.string().optional(),
  modules: z.array(z.object({ title: z.string(), description: z.string().optional(), durationMinutes: z.number() })),
  thumbnail: z.string().optional(),
  rating: z.number().min(0).max(5),
  enrollmentCount: z.number().min(0),
});

export interface SyncResult {
  providers: { id: string; fetched: number; created: number; updated: number; invalid: number; error?: string }[];
  totalCreated: number;
  totalUpdated: number;
  embeddingsQueued: number;
  syncedAt: string;
}

/**
 * Course sync pipeline (prompt §16):
 *   External API → fetch → validate → normalize → dedupe → update MongoDB →
 *   generate embeddings → mark sync status.
 * A failing provider never breaks the run (prompt §41) — its status is
 * recorded and previously synced data stays available (marked STALE).
 */
export const courseSyncService = {
  async syncAll(trigger: 'manual' | 'scheduled' = 'manual'): Promise<SyncResult> {
    const providers = getProviders().filter((p) => p.isConfigured());
    const result: SyncResult = {
      providers: [],
      totalCreated: 0,
      totalUpdated: 0,
      embeddingsQueued: 0,
      syncedAt: new Date().toISOString(),
    };

    for (const provider of providers) {
      const providerResult = { id: provider.id, fetched: 0, created: 0, updated: 0, invalid: 0, error: undefined as string | undefined };
      try {
        const { fetched, courses } = await provider.syncCourses();
        providerResult.fetched = fetched;
        for (const raw of courses) {
          const parsed = normalizedCourseSchema.safeParse(raw satisfies NormalizedCourse);
          if (!parsed.success) {
            providerResult.invalid += 1;
            continue;
          }
          const data = parsed.data;
          const dedupeFilter: Record<string, unknown> = data.externalId
            ? { source: data.source, externalId: data.externalId }
            : { source: data.source, title: data.title };
          const existing = await Course.findOne(dedupeFilter);
          if (existing) {
            await Course.updateOne(
              { _id: existing._id },
              {
                $set: {
                  title: data.title,
                  description: data.description,
                  url: data.url,
                  category: data.category,
                  skills: data.skills,
                  level: data.level,
                  durationHours: data.durationHours,
                  tags: data.tags,
                  learningObjectives: data.learningObjectives,
                  modules: data.modules,
                  rating: data.rating,
                  enrollmentCount: data.enrollmentCount,
                  lastSyncedAt: new Date(),
                  syncStatus: 'OK',
                  syncError: undefined,
                },
              }
            );
            // Re-embed only when meaningful text changed — hash check happens inside the job.
            embeddingJob.enqueueCourse(String(existing._id));
            providerResult.updated += 1;
          } else {
            await Course.create({
              ...data,
              lastSyncedAt: new Date(),
              syncStatus: 'OK',
            });
            providerResult.created += 1;
          }
        }
        result.embeddingsQueued += providerResult.created + providerResult.updated;
      } catch (err) {
        providerResult.error = (err as Error).message;
        // Mark this provider's courses STALE so operators know data is aging (prompt §41).
        await Course.updateMany({ source: provider.id.toUpperCase() }, { syncStatus: 'STALE' });
        log.warn({ provider: provider.id, err: providerResult.error }, 'provider sync failed — existing data kept (stale)');
      }
      result.providers.push(providerResult);
      result.totalCreated += providerResult.created;
      result.totalUpdated += providerResult.updated;
    }

    void audit(null, 'COURSE_SYNC', 'system', undefined, { trigger, ...pickCounts(result) });
    log.info(result, 'course sync complete');
    return result;
  },
};

const pickCounts = (r: SyncResult) => ({
  created: r.totalCreated,
  updated: r.totalUpdated,
  providers: r.providers.length,
});
