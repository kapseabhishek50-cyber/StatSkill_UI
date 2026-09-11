/*
External API Integration Layer

Orchestrates external API connections for iGOT, NSSTA, and other platforms.
Provides unified health monitoring and connection management.
*/

import { env } from '../config/env.js';

class IntegrationError extends Error {
  constructor(message, service, status, details = {}) {
    super(message);
    this.name = 'IntegrationError';
    this.service = service;
    this.status = status;
    this.details = details;
  }
}

/**
 * Integration health status types
 */
export const INTEGRATION_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  FAILED: 'failed',
  NOT_CONFIGURED: 'not_configured',
};

/**
 * Base integration adapter interface
 */
export class BaseIntegration {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.connected = false;
    this.lastSync = null;
    this.lastError = null;
    this.retryCount = 0;
  }

  async healthCheck() {
    throw new Error('healthCheck must be implemented by subclass');
  }

  async sync() {
    throw new Error('sync must be implemented by subclass');
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
}

/**
 * Integration health monitor
 */
export class IntegrationHealthMonitor {
  constructor() {
    this.integrations = {};
    this.healthHistory = [];
    this.checkInterval = 60000; // 1 minute
    this.maxHistorySize = 24; // hours
  }

  register(name, integration) {
    this.integrations[name] = integration;
  }

  async checkAll() {
    const results = {};
    const timestamp = new Date();

    for (const [name, integration] of Object.entries(this.integrations)) {
      try {
        const health = await integration.healthCheck();
        results[name] = {
          status: health.status,
          latency: health.latency,
          message: health.message,
          timestamp,
        };
      } catch (error) {
        results[name] = {
          status: INTEGRATION_STATUS.FAILED,
          latency: null,
          message: error.message,
          timestamp,
        };
      }
    }

    this.healthHistory.push({
      timestamp,
      services: results,
    });

    if (this.healthHistory.length > this.maxHistorySize * 4) {
      this.healthHistory.shift();
    }

    return results;
  }

  getServiceStatus(serviceName) {
    if (!this.healthHistory.length) return null;

    const latest = this.healthHistory[this.healthHistory.length - 1];
    return latest.services[serviceName] || null;
  }

  getOverallStatus() {
    if (!this.healthHistory.length) return INTEGRATION_STATUS.NOT_CONFIGURED;

    const latest = this.healthHistory[this.healthHistory.length - 1];
    const statuses = Object.values(latest.services).map(s => s.status);

    if (statuses.includes(INTEGRATION_STATUS.FAILED)) return INTEGRATION_STATUS.FAILED;
    if (statuses.includes(INTEGRATION_STATUS.DEGRADED)) return INTEGRATION_STATUS.DEGRADED;
    if (statuses.every(s => s.status === INTEGRATION_STATUS.HEALTHY)) return INTEGRATION_STATUS.HEALTHY;

    return INTEGRATION_STATUS.DEGRADED;
  }
}

/**
 * Get integration status for API response
 */
export async function getIntegrationStatus() {
  const monitor = new IntegrationHealthMonitor();

  // Dynamically import all integration modules
  const integrationModules = await Promise.all([
    import('./igotApi.js').then(m => m.default),
    import('./nsstaApi.js').then(m => m.default),
    import('./trainingApi.js').then(m => m.default),
    import('./statisticsApi.js').then(m => m.default),
  ]);

  integrationModules.forEach((integration, index) => {
    const serviceNames = ['igot', 'nssta', 'training', 'statistics'];
    if (integration && integration.name) {
      monitor.register(integration.name, integration);
    }
  });

  // Check if required integrations are configured
  if (env.igotApiKey) {
    const igotIntegration = integrationModules[0];
    if (igotIntegration) monitor.register('igot', igotIntegration);
  }

  if (env.nsstaApiKey) {
    const nsstaIntegration = integrationModules[1];
    if (nsstaIntegration) monitor.register('nssta', nsstaIntegration);
  }

  const services = await monitor.checkAll();

  const statusCounts = Object.values(services).reduce((acc, service) => {
    acc[service.status] = (acc[service.status] || 0) + 1;
    return acc;
  }, {});

  let overallStatus = monitor.getOverallStatus();
  if (overallStatus === INTEGRATION_STATUS.NOT_CONFIGURED) {
    // If no integrations configured, still report healthy for core services
    overallStatus = INTEGRATION_STATUS.HEALTHY;
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: services,
    configuredServices: Object.keys(services),
    healthyCount: statusCounts[INTEGRATION_STATUS.HEALTHY] || 0,
    degradedCount: statusCounts[INTEGRATION_STATUS.DEGRADED] || 0,
    failedCount: statusCounts[INTEGRATION_STATUS.FAILED] || 0,
    notConfiguredCount: statusCounts[INTEGRATION_STATUS.NOT_CONFIGURED] || 0,
  };
}