import { enqueueJob } from './queue';
import { recommendationService } from '../services/recommendation/recommendation.service';
import { logger } from '../utils/logger';

const log = logger;

export const recommendationJob = {
  name: 'recommendation.refresh',

  /** Async refresh triggered after assessments/quizzes/profile changes. */
  enqueue(userId: string, opts: { topN?: number; competencyCode?: string } = {}): void {
    void enqueueJob(
      this.name,
      async () => {
        await recommendationService.refreshForUser(userId, opts);
      },
      this.name
    ).catch((err) => log.warn({ err: (err as Error).message }, 'enqueue failed'));
  },

  async run(userId: string, opts: { topN?: number; competencyCode?: string } = {}) {
    return recommendationService.refreshForUser(userId, opts);
  },
};
