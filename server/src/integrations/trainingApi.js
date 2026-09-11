/*
Generic Training Provider API Integration

Adapter for external training platforms and learning management systems.
*/

import { INTEGRATION_STATUS } from './index.js';

export class TrainingApiIntegration {
  constructor() {
    this.name = 'training';
    this.config = {
      baseUrl: process.env.TRAINING_API_URL,
      apiKey: process.env.TRAINING_API_KEY,
      timeout: 30000,
    };

    this.connected = false;
    this.lastSync = null;
    this.lastError = null;
    this.retryCount = 0;
  }

  async healthCheck() {
    const startTime = Date.now();

    try {
      if (!this.config.baseUrl || !this.config.apiKey) {
        return {
          status: INTEGRATION_STATUS.NOT_CONFIGURED,
          latency: null,
          message: 'Training API configuration missing',
        };
      }

      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Training API returned ${response.status}`);
      }

      this._markHealthy();
      this.lastSync = new Date();

      return {
        status: INTEGRATION_STATUS.HEALTHY,
        latency: Date.now() - startTime,
        message: 'Training API is responding normally',
      };
    } catch (error) {
      this._markFailed(error);
      return {
        status: this.config.baseUrl && this.config.apiKey ?
          INTEGRATION_STATUS.DEGRADED : INTEGRATION_STATUS.NOT_CONFIGURED,
        latency: Date.now() - startTime,
        message: error.message,
      };
    }
  }

  async sync() {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error('Training API not configured');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/courses`, {
        method: 'GET',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch training courses: ${response.status}`);
      }

      const rawData = await response.json();
      const normalizedCourses = this.normalizeCourses(rawData);

      this._markHealthy();
      this.lastSync = new Date();
      this.retryCount = 0;

      return {
        courses: normalizedCourses,
        timestamp: new Date().toISOString(),
        source: 'training',
      };
    } catch (error) {
      this._markFailed(error);
      throw error;
    }
  }

  _getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
  }

  _markHealthy() {
    this.connected = true;
    this.lastError = null;
    this.retryCount = 0;
  }

  _markFailed(error) {
    this.connected = false;
    this.lastError = error.message;
    this.retryCount += 1;
  }

  normalizeCourses(rawData) {
    if (!Array.isArray(rawData)) return [];

    return rawData.map(item => ({
      id: item.id || `training-${item.courseId}`,
      code: item.code || item.courseCode,
      title: item.title || item.courseName,
      description: item.description || '',
      provider: item.provider || 'External Training',
      source: item.source || 'External Learning Platform',
      category: item.category || 'Training',
      level: item.level || 3,
      duration: item.duration || '4 hours',
      url: item.url || '',
      registrationUrl: item.registrationUrl || item.url,
      tags: item.tags || [],
      competencies: (item.competencies || []).map(c => ({
        name: c.name || c.skill,
        targetLevel: c.level || 3,
      })),
      eligibility: item.eligibility || '',
      targetAudience: item.audience || '',
      modality: item.modality || 'online',
      rating: item.rating || 4.0,
    }));
  }
}

export default new TrainingApiIntegration();