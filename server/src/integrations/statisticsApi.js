/*
Official Statistics Datasets API Integration

Adapter for accessing official statistical datasets from government sources
like MOSPI, NSO, and other statistical agencies.
*/

import { INTEGRATION_STATUS } from './index.js';

export class StatisticsApiIntegration {
  constructor() {
    this.name = 'statistics';
    this.config = {
      baseUrl: process.env.STATISTICS_API_URL,
      apiKey: process.env.STATISTICS_API_KEY,
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
          message: 'Statistics API configuration missing',
        };
      }

      const response = await fetch(`${this.config.baseUrl}/health`, {
        method: 'GET',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Statistics API returned ${response.status}`);
      }

      this._markHealthy();
      this.lastSync = new Date();

      return {
        status: INTEGRATION_STATUS.HEALTHY,
        latency: Date.now() - startTime,
        message: 'Statistics API is responding normally',
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
      throw new Error('Statistics API not configured');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/datasets`, {
        method: 'GET',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch statistics datasets: ${response.status}`);
      }

      const rawData = await response.json();
      const normalizedDatasets = this.normalizeDatasets(rawData);

      this._markHealthy();
      this.lastSync = new Date();
      this.retryCount = 0;

      return {
        datasets: normalizedDatasets,
        timestamp: new Date().toISOString(),
        source: 'statistics',
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

  normalizeDatasets(rawData) {
    if (!Array.isArray(rawData)) return [];

    return rawData.map(dataset => ({
      id: dataset.id || `stat-${dataset.datasetId}`,
      title: dataset.title || dataset.name,
      description: dataset.description || '',
      provider: dataset.provider || 'Official Statistics Agency',
      source: dataset.source || 'Government Statistical Database',
      category: dataset.category || 'Official Statistics',
      type: dataset.type || 'dataset',
      frequency: dataset.frequency || 'Annual',
      temporalCoverage: dataset.temporalCoverage || 'Historical',
      geographicalCoverage: dataset.geographicalCoverage || 'National',
      methodology: dataset.methodology || '',
      accessRights: dataset.accessRights || 'Public',
      url: dataset.url || '',
      downloadUrl: dataset.downloadUrl || '',
      variables: dataset.variables || [],
      keywords: dataset.keywords || [],
      tags: [
        dataset.category,
        dataset.frequency,
        ...(dataset.themes || []),
      ].filter(Boolean),
      lastUpdated: dataset.lastUpdated ? new Date(dataset.lastUpdated) : null,
      releaseDate: dataset.releaseDate ? new Date(dataset.releaseDate) : null,
    }));
  }

  async getDatasets(filter = {}) {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error('Statistics API not configured');
    }

    try {
      let url = `${this.config.baseUrl}/datasets`;
      const params = new URLSearchParams();

      if (filter.category) params.append('category', filter.category);
      if (filter.type) params.append('type', filter.type);
      if (filter.year) params.append('year', filter.year);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch datasets: ${response.status}`);
      }

      const rawData = await response.json();
      return Array.isArray(rawData) ? rawData : [];
    } catch (error) {
      this._markFailed(error);
      throw error;
    }
  }

  async getDataset(datasetId) {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error('Statistics API not configured');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/datasets/${datasetId}`, {
        method: 'GET',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch dataset ${datasetId}: ${response.status}`);
      }

      const rawData = await response.json();
      return this.normalizeDatasets([rawData])[0];
    } catch (error) {
      this._markFailed(error);
      throw error;
    }
  }

  async getIndicators(filter = {}) {
    if (!this.config.baseUrl || !this.config.apiKey) {
      throw new Error('Statistics API not configured');
    }

    try {
      let url = `${this.config.baseUrl}/indicators`;
      const params = new URLSearchParams();

      if (filter.category) params.append('category', filter.category);
      if (filter.frequency) params.append('frequency', filter.frequency);
      if (filter.year) params.append('year', filter.year);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this._getHeaders(),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch indicators: ${response.status}`);
      }

      const rawData = await response.json();
      return Array.isArray(rawData) ? rawData : [];
    } catch (error) {
      this._markFailed(error);
      throw error;
    }
  }
}

export default new StatisticsApiIntegration();