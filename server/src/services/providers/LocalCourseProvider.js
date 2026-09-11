/*
Local Course Provider

Provides course data from the local MongoDB database.
This is the default provider used when no external API is configured.
*/

import { Course } from '../../models/index.js';

export const LocalCourseProvider = {
  name: 'local',

  async getCourses(filter = {}) {
    const query = { isActive: true };

    if (filter.provider) {
      query.provider = filter.provider;
    }
    if (filter.category) {
      query['competencies.competency.category'] = filter.category;
    }
    if (filter.level) {
      query['competencies.targetLevel'] = { $lte: filter.level };
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
      ];
    }

    try {
      const courses = await Course.find(query)
        .populate('competencies.competency', 'code name category')
        .sort({ rating: -1, title: 1 })
        .lean();

      return courses.map(course => ({
        id: course._id,
        code: course.code,
        title: course.title,
        description: course.description,
        provider: course.provider || 'internal',
        source: course.provider === 'NSSTA' ? 'NSSTA TPAC Annual Calendar' : 'iGOT Karmayogi Portal',
        category: course.competencies?.[0]?.competency?.category || 'statistical',
        level: course.targetLevel || 3,
        durationHours: course.durationHours || 4,
        modality: course.modality || 'self_paced',
        rating: course.rating || 4.5,
        url: course.url,
        registrationUrl: course.url,
        tags: course.tags || [],
        competencies: course.competencies || [],
      }));
    } catch (error) {
      console.error('[LocalCourseProvider] Failed to fetch courses:', error.message);
      return [];
    }
  },

  async getCourseById(courseId) {
    try {
      const course = await Course.findById(courseId)
        .populate('competencies.competency', 'code name category')
        .lean();

      if (!course) return null;

      return {
        id: course._id,
        code: course.code,
        title: course.title,
        description: course.description,
        provider: course.provider || 'internal',
        source: course.provider === 'NSSTA' ? 'NSSTA TPAC Annual Calendar' : 'iGOT Karmayogi Portal',
        durationHours: course.durationHours,
        modality: course.modality,
        rating: course.rating,
        url: course.url,
        tags: course.tags,
        competencies: course.competencies,
      };
    } catch (error) {
      console.error('[LocalCourseProvider] Failed to fetch course:', error.message);
      return null;
    }
  },

  async searchCourses(query) {
    return this.getCourses({ search: query });
  },

  async getCategories() {
    try {
      const categories = await Course.distinct('competencies.competency.category', { isActive: true });
      return categories.map(name => ({ name }));
    } catch (error) {
      console.error('[LocalCourseProvider] Failed to fetch categories:', error.message);
      return [];
    }
  },

  async getTrainingPrograms() {
    return this.getCourses({ type: 'training' });
  },

  async healthCheck() {
    try {
      await Course.countDocuments();
      return { status: 'healthy', latency: 0, message: 'Local database connected' };
    } catch (error) {
      return { status: 'failed', latency: 0, message: error.message };
    }
  },
};