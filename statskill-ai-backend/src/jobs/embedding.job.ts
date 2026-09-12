import { enqueueJob } from './queue';
import { Course } from '../models/Course';
import { Material } from '../models/Material';
import { MaterialChunk } from '../models/MaterialChunk';
import { ensureCourseEmbedding } from '../services/recommendation/semantic.service';
import { getEmbeddingProvider } from '../ai/embeddings/embedding.service';
import { logger } from '../utils/logger';

const log = logger;

export const embeddingJob = {
  name: 'embedding.course',

  enqueueCourse(courseId: string): void {
    void enqueueJob(
      this.name,
      async () => {
        const course = await Course.findById(courseId);
        if (course) await ensureCourseEmbedding(course, true);
      },
      this.name
    ).catch(() => undefined);
  },

  /** Re-embeds every course whose text changed (taxonomy updates, syncs). */
  async runAllCourses(limit = 500): Promise<number> {
    const courses = await Course.find({ isActive: true }).limit(limit);
    let updated = 0;
    for (const course of courses) {
      await ensureCourseEmbedding(course);
      updated += 1;
    }
    log.info({ updated }, 'course embeddings refreshed');
    return updated;
  },

  /** Embeds material chunks for RAG (quiz generation / summarization). */
  async runMaterialChunks(materialId: string): Promise<number> {
    const chunks = await MaterialChunk.find({ materialId, embedding: { $exists: false } }).limit(200);
    if (!chunks.length) return 0;
    const provider = getEmbeddingProvider();
    try {
      const vectors = await provider.embedMany(chunks.map((c) => c.text));
      for (let i = 0; i < chunks.length; i++) {
        chunks[i].embedding = vectors[i];
        chunks[i].embeddingProvider = provider.name;
        await chunks[i].save();
      }
      return chunks.length;
    } catch (err) {
      log.warn({ err: (err as Error).message, materialId }, 'chunk embedding failed');
      return 0;
    }
  },
};
