/*
NSSTA Training Academy API Integration

Adapter for the National Statistical Systems Training Academy (NSSTA),
which provides training programs, workshops, and training calendars for
officers in the Indian official statistical system.
*/

import { INTEGRATION_STATUS } from './index.js';

export class NSSTAIntegration {
  constructor() {
    this.name = 'nssta';
    this.config = {
      baseUrl: process.env.NSSTA_API_URL,
      apiKey: process.env.NSSTA_API_KEY,
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
          message: 'NSSTA API configuration missing',
        };
      }

      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`NSSTA API returned ${response.status}`);
      }

      this._markHealthy();
      this.lastSync = new Date();

      return {
        status: INTEGRATION_STATUS.HEALTHY,
        latency: Date.now() - startTime,
        message: 'NSSTA API is responding normally',
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
      throw new Error('NSSTA API not configured');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/training-programs`, {
        method: 'GET',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch NSSTA training programs: ${response.status}`);
      }

      const rawData = await response.json();
      const normalizedPrograms = this.normalizeTrainingPrograms(rawData);

      this._markHealthy();
      this.lastSync = new Date();
      this.retryCount = 0;

      return {
        programs: normalizedPrograms,
        timestamp: new Date().toISOString(),
        source: 'nssta',
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

  normalizeTrainingPrograms(rawData) {
    if (!Array.isArray(rawData)) {
      return [];
    }

    return rawData.map(item => ({
      id: item.id || item.programId || `nssta-${item.code}`,
      code: item.code || item.programCode,
      title: item.title || item.programName || item.name,
      description: item.description || item.summary || '',
      provider: 'NSSTA',
      source: 'NSSTA TPAC Annual Calendar',
      category: item.category || item.domain || 'Statistical Training',
      type: item.type || 'training',
      duration: item.duration || item.durationHours || '8 hours',
      modality: item.modality || 'in_person',
      eligibility: item.eligibility || 'NSSTA Registered Officers',
      targetAudience: item.audience || 'Statistical Officers',
      startDate: item.startDate ? new Date(item.startDate) : null,
      endDate: item.endDate ? new Date(item.endDate) : null,
      registrationUrl: item.registrationUrl || item.url,
      status: item.status || 'open',
      seatsAvailable: item.seatsAvailable || 0,
      venue: item.venue || item.location || '',
      trainers: item.trainers || [],
      tags: [
        item.category,
        item.type,
        ...(item.skills || []),
      ].filter(Boolean),
      competencies: (item.competencies || []).map(comp => ({
        name: comp.name || comp.skill,
        targetLevel: comp.level || 3,
      })),
    }));
  }

  async getTrainingPrograms(filter = {}) {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error('NSSTA API not configured');
    }

    try {
      let url = `${this.config.baseUrl}/training-programs`;
      const params = new URLSearchParams();

      if (filter.category) params.append('category', filter.category);
      if (filter.status) params.append('status', filter.status);
      if (filter.type) params.append('type', filter.type);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this._getHeaders(),
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

  async getWorkshops(filter = {}) {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error('NSSTA API not configured');
    }

    try {
      let url = `${this.config.baseUrl}/workshops`;
      const params = new URLSearchParams();

      if (filter.category) params.append('category', filter.category);
      if (filter.status) params.append('status', filter.status);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workshops: ${response.status}`);
      }

      const rawData = await response.json();
      return Array.isArray(rawData) ? rawData : [];
    } catch (error) {
      this._markFailed(error);
      throw error;
    }
  }

  async getTrainingCategories() {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error('NSSTA API not configured');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/categories`, {
        method: 'GET',
        headers: this._getHeaders(),
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

  async getCalendar(filter = {}) {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error('NSSTA API not configured');
    }

    try {
      let url = `${this.config.baseUrl}/calendar`;
      const params = new URLSearchParams();

      if (filter.year) params.append('year', filter.year);
      if (filter.department) params.append('department', filter.department);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.status}`);
      }

      const rawData = await response.json();
      return Array.isArray(rawData) ? rawData : [];
    } catch (error) {
      this._markFailed(error);
      throw error;
    }
  }
}

export default new NSSTAIntegration();