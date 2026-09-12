import { ICourse } from '../../models/Course';

/**
 * Course provider abstraction (prompt §15). Official data sources plug in here
 * without any frontend change. Implementations activate only when configured
 * (URL + key); the app never assumes an external API exists.
 */
export interface CourseProvider {
  readonly id: string; // 'igot' | 'nssta' | 'mospi' | 'mock'
  readonly displayName: string;
  /** True only when both endpoint and credentials are configured. */
  isConfigured(): boolean;
  getCourses(opts?: ProviderQueryOptions): Promise<NormalizedCourse[]>;
  getCourseById(externalId: string): Promise<NormalizedCourse | null>;
  searchCourses(query: string, opts?: ProviderQueryOptions): Promise<NormalizedCourse[]>;
  getCategories(): Promise<string[]>;
  /** Full sync pull. Providers should page internally if supported. */
  syncCourses(): Promise<{ fetched: number; courses: NormalizedCourse[] }>;
}

export interface ProviderQueryOptions {
  category?: string;
  level?: string;
  limit?: number;
  offset?: number;
}

/** Provider-normalized course shape — validated before persistence. */
export interface NormalizedCourse {
  title: string;
  description: string;
  provider: string;
  source: ICourse['source'];
  externalId?: string;
  url?: string;
  category: string;
  skills: string[]; // competency codes
  level: ICourse['level'];
  durationHours: number;
  language: string;
  tags: string[];
  learningObjectives: string[];
  eligibility?: string;
  modules: { title: string; description?: string; durationMinutes: number }[];
  thumbnail?: string;
  rating: number;
  enrollmentCount: number;
}
