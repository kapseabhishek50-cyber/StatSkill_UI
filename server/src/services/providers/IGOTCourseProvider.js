/*
IGOT Course Provider

Provides course data from the iGOT Karmayogi platform via the iGOT integration adapter.
*/

import { courseProvider } from '../courseProvider.js';
import igotIntegration from '../../integrations/igotApi.js';

export const IGOTCourseProvider = {
  name: 'igot',

  async getCourses(filter = {}) {
    if (!process.env.IGOT_API_URL || !process.env.IGOT_API_KEY) {
      return [];
    }

    try {
      const result = await igotIntegration.sync();
      let courses = result.courses;

      if (filter.category) {
        courses = courses.filter(c => c.category === filter.category);
      }
      if (filter.provider) {
        courses = courses.filter(c => c.provider === filter.provider);
      }
      if (filter.competency) {
        courses = courses.filter(c =>
          c.competencies.some(comp =>
            comp.name === filter.competency || String(comp._id) === String(filter.competency)
          )
        );
      }
      if (filter.level) {
        courses = courses.filter(c => c.level <= filter.level);
      }
      if (filter.search) {
        const q = filter.search.toLowerCase();
        courses = courses.filter(c =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some(t => t.toLowerCase().includes(q))
        );
      }

      return courses;
    } catch (error) {
      console.error('[IGOTCourseProvider] Failed to fetch courses:', error.message);
      return [];
    }
  },

  async getCourseById(courseId) {
    if (!process.env.IGOT_API_URL || !process.env.IGOT_API_KEY) {
      return null;
    }

    try {
      return await igotIntegration.getCourse(courseId);
    } catch (error) {
      console.error('[IGOTCourseProvider] Failed to fetch course:', error.message);
      return null;
    }
  },

  async searchCourses(query) {
    return this.getCourses({ search: query });
  },

  async getCategories() {
    if (!process.env.IGOT_API_URL || !process.env.IGOT_API_KEY) {
      return [];
    }

    try {
      return await igotIntegration.getCategories();
    } catch (error) {
      console.error('[IGOTCourseProvider] Failed to fetch categories:', error.message);
      return [];
    }
  },

  async getTrainingPrograms() {
    if (!process.env.IGOT_API_URL || !process.env.IGOT_API_KEY) {
      return [];
    }

    try {
      return await igotIntegration.getTrainingPrograms();
    } catch (error) {
      console.error('[IGOTCourseProvider] Failed to fetch training programs:', error.message);
      return [];
    }
  },

  async healthCheck() {
    return igotIntegration.healthCheck();
  },
};