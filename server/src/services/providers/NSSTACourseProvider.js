/*
NSSTA Course Provider

Provides course data from the NSSTA training calendar and programs.
*/

import nsstaIntegration from '../../integrations/nsstaApi.js';

export const NSSTACourseProvider = {
  name: 'nssta',

  async getCourses(filter = {}) {
    if (!process.env.NSSTA_API_URL || !process.env.NSSTA_API_KEY) {
      return [];
    }

    try {
      let programs = await nsstaIntegration.sync().then(r => r.programs);

      if (filter.category) {
        programs = programs.filter(c => c.category === filter.category);
      }
      if (filter.type) {
        programs = programs.filter(c => c.type === filter.type);
      }
      if (filter.status) {
        programs = programs.filter(c => c.status === filter.status);
      }
      if (filter.level) {
        programs = programs.filter(c => c.level <= filter.level);
      }
      if (filter.search) {
        const q = filter.search.toLowerCase();
        programs = programs.filter(c =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some(t => t.toLowerCase().includes(q))
        );
      }

      return programs;
    } catch (error) {
      console.error('[NSSTACourseProvider] Failed to fetch programs:', error.message);
      return [];
    }
  },

  async getCourseById(courseId) {
    if (!process.env.NSSTA_API_URL || !process.env.NSSTA_API_KEY) {
      return null;
    }

    try {
      const programs = await nsstaIntegration.sync().then(r => r.programs);
      return programs.find(c => String(c.id) === String(courseId)) || null;
    } catch (error) {
      console.error('[NSSTACourseProvider] Failed to fetch program:', error.message);
      return null;
    }
  },

  async searchCourses(query) {
    return this.getCourses({ search: query });
  },

  async getCategories() {
    if (!process.env.NSSTA_API_URL || !process.env.NSSTA_API_KEY) {
      return [];
    }

    try {
      return await nsstaIntegration.getTrainingCategories();
    } catch (error) {
      console.error('[NSSTACourseProvider] Failed to fetch categories:', error.message);
      return [];
    }
  },

  async getTrainingPrograms() {
    if (!process.env.NSSTA_API_URL || !process.env.NSSTA_API_KEY) {
      return [];
    }

    try {
      return await nsstaIntegration.getTrainingPrograms();
    } catch (error) {
      console.error('[NSSTACourseProvider] Failed to fetch training programs:', error.message);
      return [];
    }
  },

  async healthCheck() {
    return nsstaIntegration.healthCheck();
  },
};