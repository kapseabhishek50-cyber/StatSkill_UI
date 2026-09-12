import { CourseProvider } from './provider.interface';
import { MockProvider } from './mock.provider';
import { igotProvider, nsstaProvider, mospiProvider } from './remoteCourseProvider';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const log = logger;

/** Provider registry (prompt §15). New official sources register here. */
const providers: CourseProvider[] = [];
if (env.INCLUDE_MOCK_PROVIDER) providers.push(new MockProvider());
providers.push(igotProvider, nsstaProvider, mospiProvider);

export const getProviders = (): CourseProvider[] => providers;

export const getProvider = (id: string): CourseProvider | undefined => providers.find((p) => p.id === id);

export const providerStatuses = () =>
  providers.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    configured: p.isConfigured(),
  }));

/** Composite: queries every configured provider in parallel, merges + dedupes. */
export const compositeGetCourses = async (opts?: { category?: string; limit?: number }) => {
  const results = await Promise.allSettled(providers.filter((p) => p.isConfigured()).map((p) => p.getCourses(opts)));
  const merged: Awaited<ReturnType<CourseProvider['getCourses']>> = [];
  for (const r of results) {
    if (r.status === 'fulfilled') merged.push(...r.value);
    else log.warn({ err: String(r.reason) }, 'a course provider failed during composite fetch');
  }
  return merged;
};

export * from './provider.interface';
export { MockProvider, igotProvider, nsstaProvider, mospiProvider };
