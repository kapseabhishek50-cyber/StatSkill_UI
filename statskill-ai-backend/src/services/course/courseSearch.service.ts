import { Request } from 'express';
import { Course } from '../../models/Course';
import { parsePagination, mongoSort, buildPagination } from '../../utils/pagination';
import { multiFieldSearch } from '../../utils/search';
import { getEmbeddingProvider } from '../../ai/embeddings/embedding.service';
import { CourseEmbedding } from '../../models/CourseEmbedding';
import { cosineSimilarity } from '../../utils/math';
import { logger } from '../../utils/logger';

const log = logger;

/**
 * Course search: keyword relevance ranking (title > tags/skills > description)
 * with optional semantic re-ranking using stored embeddings (prompt §35).
 */
export const courseSearchService = {
  async search(query: string, req: Request, opts: { semantic?: boolean } = {}) {
    const p = parsePagination(req.query);
    const matched = await multiFieldSearch(
      Course,
      ['title', 'description', 'tags', 'skills', 'category', 'provider'],
      query,
      { baseFilter: { isActive: true }, limit: 500 }
    );

    const total = matched.length;
    const sorted = [...matched].sort((a, b) => {
      const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const score = (c: typeof a): number => {
        let s = 0;
        if (rx.test(c.title)) s += 3;
        if (c.tags.some((t) => rx.test(t))) s += 2;
        if (c.skills.some((sk) => sk.toLowerCase().replace(/_/g, ' ').includes(query.toLowerCase()))) s += 2;
        return s;
      };
      return score(b) - score(a);
    });

    const pageItems = sorted.slice(p.skip, p.skip + p.limit);

    if (opts.semantic) {
      try {
        const provider = getEmbeddingProvider();
        const qVec = await provider.embed(query);
        const ids = pageItems.map((c) => String(c._id));
        const vecs = await CourseEmbedding.find({ courseId: { $in: ids } });
        const vMap = new Map(vecs.map((v) => [String(v.courseId), v.vector]));
        for (const c of pageItems) {
          (c as unknown as { relevance?: number }).relevance = 0;
          const cv = vMap.get(String(c._id));
          if (cv) (c as unknown as { relevance?: number }).relevance = Math.round(cosineSimilarity(qVec, cv) * 100) / 100;
        }
      } catch (err) {
        log.warn({ err: (err as Error).message }, 'semantic re-ranking skipped');
      }
    }

    return {
      items: pageItems.map((c) => ({
        ...(c.toObject() as Record<string, unknown>),
        relevance: (c as unknown as { relevance?: number }).relevance ?? 0,
      })),
      pagination: buildPagination(total, p),
      query,
      semantic: Boolean(opts.semantic),
    };
  },
};
