import { Course } from '../models/index.js';
import { CompositeCourseProvider } from './providers/CompositeProvider.js';
import { LocalCourseProvider } from './providers/LocalCourseProvider.js';
import { IGOTCourseProvider } from './providers/IGOTCourseProvider.js';
import { NSSTACourseProvider } from './providers/NSSTACourseProvider.js';

/**
 * Course Provider Abstraction.
 *
 * Acts as a facade over the composite provider, which intelligently merges
 * courses from multiple sources (Local database, iGOT Karmayogi, NSSTA TPAC).
 *
 * When external API credentials are configured, courses from those sources
 * are automatically included. The frontend is unaware of which provider supplied
 * any given course.
 */
export const courseProvider = {
  async getCourses(filter = {}) {
    return CompositeCourseProvider.getCourses(filter);
  },

  async getCourseById(courseId) {
    return CompositeCourseProvider.getCourseById(courseId);
  },

  async searchCourses(query) {
    return CompositeCourseProvider.searchCourses(query);
  },

  async getCategories() {
    return CompositeCourseProvider.getCategories();
  },

  async getTrainingPrograms() {
    return CompositeCourseProvider.getTrainingPrograms();
  },

  async healthCheck() {
    return CompositeCourseProvider.healthCheck();
  },

  /**
   * Direct access to specific providers (for testing/debugging)
   */
  providers: {
    local: LocalCourseProvider,
    igot: IGOTCourseProvider,
    nssta: NSSTACourseProvider,
    composite: CompositeCourseProvider,
  },

  /**
   * Get statistics about which providers are active
   */
  getProviderStats() {
    return CompositeCourseProvider.getProviderStats();
  },

  /**
   * Legacy method for backwards compatibility - direct local access
   */
  async _getCoursesLocal(filter = {}) {
    const query = { isActive: true };
    if (filter.provider) query.provider = filter.provider;
    if (filter.competency) query['competencies.competency'] = filter.competency;

    const courses = await Course.find(query)
      .populate('competencies.competency', 'code name category')
      .sort({ rating: -1, title: 1 })
      .lean();

    return courses.map((course) => ({
      id: course._id,
      code: course.code,
      title: course.title,
      provider: course.provider,
      source: course.provider === 'NSSTA' ? 'NSSTA TPAC Annual Calendar' : 'iGOT Karmayogi Portal',
      category: course.competencies?.[0]?.competency?.category || 'statistical',
      targetAudience: 'Indian Statistical Service (ISS) & Subordinate Statistical Service (SSS) Officers',
      durationHours: course.durationHours || 4,
      modality: course.modality || 'self_paced',
      rating: course.rating || 4.5,
      url: course.url,
      registrationUrl: course.url,
      description: course.description,
      tags: course.tags || [],
      competencies: course.competencies || [],
    }));
  },
};

