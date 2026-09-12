import { CourseProvider, NormalizedCourse, ProviderQueryOptions } from './provider.interface';
import { MOCK_COURSES } from '../../data/mockCourses';

/** Built-in demo catalogue (development/demo only — prompt §50). */
export class MockProvider implements CourseProvider {
  readonly id = 'mock';
  readonly displayName = 'StatSkill Demo Catalogue';

  isConfigured(): boolean {
    return true;
  }

  async getCourses(opts: ProviderQueryOptions = {}): Promise<NormalizedCourse[]> {
    let courses = [...MOCK_COURSES];
    if (opts.category) courses = courses.filter((c) => c.category.toLowerCase() === opts.category!.toLowerCase());
    if (opts.level) courses = courses.filter((c) => c.level === opts.level);
    const offset = opts.offset ?? 0;
    return courses.slice(offset, offset + (opts.limit ?? courses.length));
  }

  async getCourseById(externalId: string): Promise<NormalizedCourse | null> {
    return MOCK_COURSES.find((c) => c.externalId === externalId) ?? null;
  }

  async searchCourses(query: string, opts: ProviderQueryOptions = {}): Promise<NormalizedCourse[]> {
    const q = query.toLowerCase();
    const matched = MOCK_COURSES.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        c.skills.some((s) => s.toLowerCase().replace(/_/g, ' ').includes(q))
    );
    return matched.slice(0, opts.limit ?? matched.length);
  }

  async getCategories(): Promise<string[]> {
    return [...new Set(MOCK_COURSES.map((c) => c.category))];
  }

  async syncCourses(): Promise<{ fetched: number; courses: NormalizedCourse[] }> {
    return { fetched: MOCK_COURSES.length, courses: [...MOCK_COURSES] };
  }
}
