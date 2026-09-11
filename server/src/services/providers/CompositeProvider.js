/*
Composite Course Provider

Merges course data from all providers (Local, iGOT, NSSTA) with deduplication.
*/

import { LocalCourseProvider } from './LocalCourseProvider.js';
import { IGOTCourseProvider } from './IGOTCourseProvider.js';
import { NSSTACourseProvider } from './NSSTACourseProvider.js';

export const CompositeCourseProvider = {
  name: 'composite',

  async getCourses(filter = {}) {
    // Fetch from all providers concurrently
    const [localCourses, igotCourses, nsstaCourses] = await Promise.allSettled([
      LocalCourseProvider.getCourses(filter),
      IGOTCourseProvider.getCourses(filter),
      NSSTACourseProvider.getCourses(filter),
    ]);

    let allCourses = [];

    if (localCourses.status === 'fulfilled') {
      allCourses = allCourses.concat(
        localCourses.value.map(c => ({ ...c, _source: 'local' }))
      );
    }

    if (igotCourses.status === 'fulfilled') {
      allCourses = allCourses.concat(
        igotCourses.value.map(c => ({ ...c, _source: 'igot' }))
      );
    }

    if (nsstaCourses.status === 'fulfilled') {
      allCourses = allCourses.concat(
        nsstaCourses.value.map(c => ({ ...c, _source: 'nssta' }))
      );
    }

    // Deduplicate by ID, preferring local courses
    const seen = new Map();
    for (const course of allCourses) {
      if (!seen.has(course.id)) {
        seen.set(course.id, course);
      }
    }

    // Sort by rating (descending) and title
    const deduplicated = Array.from(seen.values());
    deduplicated.sort((a, b) => {
      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (a.title || '').localeCompare(b.title || '');
    });

    return deduplicated;
  },

  async getCourseById(courseId) {
    // Try local first
    const localCourse = await LocalCourseProvider.getCourseById(courseId);
    if (localCourse) return { ...localCourse, _source: 'local' };

    // Try iGOT
    const igotCourse = await IGOTCourseProvider.getCourseById(courseId);
    if (igotCourse) return { ...igotCourse, _source: 'igot' };

    // Try NSSTA
    const nsstaCourse = await NSSTACourseProvider.getCourseById(courseId);
    if (nsstaCourse) return { ...nsstaCourse, _source: 'nssta' };

    return null;
  },

  async searchCourses(query) {
    return this.getCourses({ search: query });
  },

  async getCategories() {
    const [local, igot, nssta] = await Promise.allSettled([
      LocalCourseProvider.getCategories(),
      IGOTCourseProvider.getCategories(),
      NSSTACourseProvider.getCategories(),
    ]);

    const categories = new Map();

    if (local.status === 'fulfilled') {
      local.value.forEach(cat => categories.set(cat.name, { ...cat, source: 'local' }));
    }
    if (igot.status === 'fulfilled') {
      igot.value.forEach(cat => {
        if (!categories.has(cat.name)) {
          categories.set(cat.name, { ...cat, source: 'igot' });
        }
      });
    }
    if (nssta.status === 'fulfilled') {
      nssta.value.forEach(cat => {
        if (!categories.has(cat.name)) {
          categories.set(cat.name, { ...cat, source: 'nssta' });
        }
      });
    }

    return Array.from(categories.values());
  },

  async getTrainingPrograms() {
    return this.getCourses({ type: 'training' });
  },

  async healthCheck() {
    const [local, igot, nssta] = await Promise.allSettled([
      LocalCourseProvider.healthCheck(),
      IGOTCourseProvider.healthCheck(),
      NSSTACourseProvider.healthCheck(),
    ]);

    const results = {
      local: local.status === 'fulfilled' ? local.value : { status: 'failed' },
      igot: igot.status === 'fulfilled' ? igot.value : { status: 'failed' },
      nssta: nssta.status === 'fulfilled' ? nssta.value : { status: 'failed' },
    };

    const hasHealthy = Object.values(results).some(r => r.status === 'healthy');
    const hasFailed = Object.values(results).some(r => r.status === 'failed');

    return {
      status: hasHealthy && !hasFailed ? 'healthy' : hasHealthy ? 'degraded' : 'failed',
      providers: results,
    };
  },

  getProviderStats() {
    return {
      local: {
        configured: true,
        name: 'Local Database',
        description: 'MongoDB course catalog',
      },
      igot: {
        configured: !!(process.env.IGOT_API_URL && process.env.IGOT_API_KEY),
        name: 'iGOT Karmayogi',
        description: 'Government training portal',
      },
      nssta: {
        configured: !!(process.env.NSSTA_API_URL && process.env.NSSTA_API_KEY),
        name: 'NSSTA TPAC',
        description: 'National Statistical Systems Training Academy',
      },
    };
  },
};