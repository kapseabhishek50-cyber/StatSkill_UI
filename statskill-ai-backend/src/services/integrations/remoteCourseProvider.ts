import { CourseProvider, NormalizedCourse, ProviderQueryOptions } from './provider.interface';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { z } from 'zod';

const log = logger;

/**
 * Shared base for iGOT / NSSTA / MoSPI HTTP providers.
 *
 * These APIs are NOT public and no official sandbox is assumed. When the
 * project owner supplies real endpoint + credentials via env, this adapter
 * fetches, validates (zod), and normalizes courses. Until then
 * isConfigured() = false and the provider is skipped gracefully (prompt §15/§41).
 */
export class RemoteCourseProvider implements CourseProvider {
  readonly id: string;
  readonly displayName: string;
  private readonly urlEnv: () => string | undefined;
  private readonly keyEnv: () => string | undefined;
  private readonly source: NormalizedCourse['source'];

  constructor(config: {
    id: string;
    displayName: string;
    source: NormalizedCourse['source'];
    getUrl: () => string | undefined;
    getKey: () => string | undefined;
  }) {
    this.id = config.id;
    this.displayName = config.displayName;
    this.source = config.source;
    this.urlEnv = config.getUrl;
    this.keyEnv = config.getKey;
  }

  isConfigured(): boolean {
    return Boolean(this.urlEnv() && this.keyEnv());
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const base = this.urlEnv()!;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${this.keyEnv()}`,
      };
      if (this.keyEnv()) headers['X-API-KEY'] = this.keyEnv()!;
      const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers ?? {}) },
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`${this.displayName} responded ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  // Tolerant normalization: accept several common field spellings.
  private static remoteCourseSchema = z.object({
    id: z.union([z.string(), z.number()]).optional(),
    title: z.string().min(1),
    description: z.string().default(''),
    provider: z.string().optional(),
    url: z.string().optional(),
    category: z.string().default('General'),
    skills: z.array(z.string()).default([]),
    level: z.string().default('BEGINNER'),
    durationHours: z.union([z.number(), z.string()]).optional(),
    language: z.string().default('en'),
    tags: z.array(z.string()).default([]),
    learningObjectives: z.array(z.string()).default([]),
    thumbnail: z.string().optional(),
    rating: z.union([z.number(), z.string()]).optional(),
    enrollmentCount: z.union([z.number(), z.string()]).optional(),
  }).passthrough();

  normalize(raw: unknown): NormalizedCourse | null {
    const parsed = RemoteCourseProvider.remoteCourseSchema.safeParse(raw);
    if (!parsed.success) {
      log.debug({ provider: this.id, issues: parsed.error.issues.length }, 'remote course rejected');
      return null;
    }
    const d = parsed.data;
    const level = String(d.level).toUpperCase();
    const num = (v: unknown, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    return {
      title: d.title.trim(),
      description: d.description,
      provider: d.provider ?? this.displayName,
      source: this.source,
      externalId: d.id != null ? String(d.id) : undefined,
      url: d.url,
      category: d.category,
      skills: d.skills.map((s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '_')),
      level: (['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(level) ? level : 'BEGINNER') as NormalizedCourse['level'],
      durationHours: num(d.durationHours, 4),
      language: d.language,
      tags: d.tags,
      learningObjectives: d.learningObjectives,
      modules: [],
      thumbnail: d.thumbnail,
      rating: Math.min(5, num(d.rating, 4)),
      enrollmentCount: num(d.enrollmentCount, 0),
    };
  }

  async getCourses(opts: ProviderQueryOptions = {}): Promise<NormalizedCourse[]> {
    if (!this.isConfigured()) return [];
    try {
      const params = new URLSearchParams();
      if (opts.category) params.set('category', opts.category);
      if (opts.limit) params.set('limit', String(opts.limit));
      if (opts.offset) params.set('offset', String(opts.offset));
      const data = await this.request<unknown>(`/courses?${params.toString()}`);
      const list = Array.isArray(data) ? data : ((data as { courses?: unknown[]; data?: unknown[] }).courses ?? (data as { data?: unknown[] }).data ?? []);
      return list.map((c) => this.normalize(c)).filter((c): c is NormalizedCourse => Boolean(c));
    } catch (err) {
      log.warn({ provider: this.id, err: (err as Error).message }, 'getCourses failed — serving previously synced data');
      return [];
    }
  }

  async getCourseById(externalId: string): Promise<NormalizedCourse | null> {
    if (!this.isConfigured()) return null;
    try {
      const data = await this.request<unknown>(`/courses/${encodeURIComponent(externalId)}`);
      return this.normalize(data);
    } catch (err) {
      log.warn({ provider: this.id, err: (err as Error).message }, 'getCourseById failed');
      return null;
    }
  }

  async searchCourses(query: string, opts: ProviderQueryOptions = {}): Promise<NormalizedCourse[]> {
    if (!this.isConfigured()) return [];
    try {
      const params = new URLSearchParams({ q: query });
      if (opts.limit) params.set('limit', String(opts.limit));
      const data = await this.request<unknown>(`/courses/search?${params.toString()}`);
      const list = Array.isArray(data) ? data : ((data as { courses?: unknown[] }).courses ?? []);
      return list.map((c) => this.normalize(c)).filter((c): c is NormalizedCourse => Boolean(c));
    } catch (err) {
      log.warn({ provider: this.id, err: (err as Error).message }, 'searchCourses failed');
      return [];
    }
  }

  async getCategories(): Promise<string[]> {
    if (!this.isConfigured()) return [];
    try {
      const data = await this.request<unknown>('/courses/categories');
      if (Array.isArray(data)) return data.map(String);
      const categories = (data as { categories?: unknown[] }).categories;
      return Array.isArray(categories) ? categories.map(String) : [];
    } catch {
      return [];
    }
  }

  async syncCourses(): Promise<{ fetched: number; courses: NormalizedCourse[] }> {
    const courses = await this.getCourses({ limit: 500 });
    return { fetched: courses.length, courses };
  }
}

export const igotProvider = new RemoteCourseProvider({
  id: 'igot',
  displayName: 'iGOT Karmayogi',
  source: 'IGOT',
  getUrl: () => env.IGOT_API_URL,
  getKey: () => env.IGOT_API_KEY,
});

export const nsstaProvider = new RemoteCourseProvider({
  id: 'nssta',
  displayName: 'NSSTA',
  source: 'NSSTA',
  getUrl: () => env.NSSTA_API_URL,
  getKey: () => env.NSSTA_API_KEY,
});

export const mospiProvider = new RemoteCourseProvider({
  id: 'mospi',
  displayName: 'MoSPI Learning Hub',
  source: 'MOSPI',
  getUrl: () => env.MOSPI_API_URL,
  getKey: () => env.MOSPI_API_KEY,
});
