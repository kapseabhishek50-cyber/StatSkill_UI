/*
iGOT Karmayogi API Integration

Adapter for the iGOT (Integrated Government Online Training) platform,
which provides mandatory training for Indian government employees.
*/

import { INTEGRATION_STATUS } from './index.js';
import { BaseIntegration } from './index.js';

export class IGOTIntegration extends BaseIntegration {
  constructor() {
    super('igot', {
      apiUrl: process.env.IGOT_API_URL,
      apiKey: process.env.IGOT_API_KEY,
      timeout: 30000,
    });

    this.baseUrl = this.config.apiUrl;
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
  }

  async healthCheck() {
    const startTime = Date.now();

    try {
      if (!this.config.apiUrl || !this.config.apiKey) {
        return {
          status: INTEGRATION_STATUS.NOT_CONFIGURED,
          latency: null,
          message: 'iGOT API configuration missing',
        };
      }

      // Basic health check - try to fetch available courses/programs
      const response = await fetch(`${this.baseUrl}/courses`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`iGOT API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      this._markHealthy();
      this.lastSync = new Date();

      return {
        status: INTEGRATION_STATUS.HEALTHY,
        latency: Date.now() - startTime,
        message: 'iGOT API is responding normally',
      };
    } catch (error) {
      this._markFailed(error);
      return {
        status: this.config.apiUrl && this.config.apiKey ?
          INTEGRATION_STATUS.DEGRADED : INTEGRATION_STATUS.NOT_CONFIGURED,
        latency: Date.now() - startTime,
        message: error.message,
      };
    }
  }

  async sync() {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new Error('iGOT API not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/courses?status=active`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch iGOT courses: ${response.status}`);
      }

      const rawData = await response.json();
      const normalizedCourses = this.normalizeResponse(rawData);

      this._markHealthy();
      this.lastSync = new Date();
      this.retryCount = 0;

      return {
        courses: normalizedCourses,
        timestamp: new Date().toISOString(),
        source: 'igot',
      };
    } catch (error) {
      this._markFailed(error);
      throw error;
    }
  }

  normalizeResponse(rawData) {
    // Normalize iGOT API response to internal course format
    if (!Array.isArray(rawData)) {
      return [];
    }

    return rawData.map(item => ({
      id: item.id || item.courseId || `igot-${item.uid}`,
      code: item.courseCode || item.code || item.id,
      title: item.courseName || item.title || item.name,
      description: item.description || item.courseDescription || '',
      provider: 'iGOT',
      source: 'iGOT Karmayogi Portal',
      skill: item.skillName || item.targetSkill || 'Government Services',
      category: item.category || item.domain || 'Government Training',
      level: this.mapLevel(item.level || item.difficulty || 'Beginner'),
      duration: item.duration || item.durationHours || '4 hours',
      url: item.courseUrl || item.url || `https://igot.gov.in/course/${item.id}`,
      registrationUrl: item.enrollmentUrl || item.url,
      tags: [
        item.tagName || item.category,
        ...(item.skills || []),
      ].filter(Boolean),
      competencies: (item.relatedSkills || []).map(skill => ({
        name: skill,
        targetLevel: this.mapLevel(item.level || 'Beginner'),
      })),
      eligibility: item.eligibility || 'Indian Government Employees',
      targetAudience: item.audience || 'Government Officials',
      startDate: item.startDate ? new Date(item.startDate) : null,
      endDate: item.endDate ? new Date(item.endDate) : null,
      modality: item.modality || 'self_paced',
      rating: item.rating || 4.5,
      status: item.status || 'active',
      accessType: item.accessType || 'free',
    }));
  }

  mapLevel(level) {
    // Normalize iGOT difficulty levels to 0-5 scale
    const levelMap = {
      'Beginner': 1,
      'Easy': 1,
      'Intermediate': 3,
      'Advanced': 5,
      'Expert': 5,
      1: 1, 2: 2, 3: 3, 4: 4, 5: 5,
      'Beginner Level': 1,
      'Intermediate Level': 3,
      'Advanced Level': 5,
    };

    if (typeof level === 'number') {
      return Math.max(0, Math.min(5, Math.round(level)));
    }

    return levelMap[level] || 1;
  }

  async getCourse(courseId) {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new Error('iGOT API not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/courses/${courseId}`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch course ${courseId}: ${response.status}`);
      }

      const rawData = await response.json();
      return this.normalizeResponse([rawData])[0];
    } catch (error) {
      this._markFailed(error);
      throw error;
    }
  }

  async getTrainingPrograms(filter = {}) {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new Error('iGOT API not configured');
    }

    try {
      let url = `${this.baseUrl}/programs`;
      const params = new URLSearchParams();

      if (filter.department) params.append('department', filter.department);
      if (filter.category) params.append('category', filter.category);
      if (filter.status) params.append('status', filter.status);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch training programs: ${response.status}`);
      }

      const rawData = await response.json();
      return Array.isArray(rawData) ? rawData : [];
    } catch (error) {
      this._markFailed(error);
      throw error;
    }
  }

  async getCategories() {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new Error('iGOT API not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/categories`, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status}`);
      }

      const rawData = await response.json();
      return Array.isArray(rawData) ? rawData : [];
    } catch (error) {
      this._markFailed(error);
      throw error;
    }
  }
}

// Create and export a default instance for use
export default new IGOTIntegration();