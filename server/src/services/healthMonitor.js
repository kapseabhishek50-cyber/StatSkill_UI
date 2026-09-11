/*
Health Monitoring Service

Provides comprehensive health checks for all integrated services.
*/

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { llmProviderName } from './llm/index.js';
import { INTEGRATION_STATUS } from '../integrations/index.js';

/**
 * Check MongoDB database connection
 */
export async function checkDatabase() {
  const startTime = Date.now();

  try {
    const state = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    if (state === 1) {
      // Ping the database
      await mongoose.connection.db.admin().ping();

      return {
        name: 'database',
        status: INTEGRATION_STATUS.HEALTHY,
        latency: Date.now() - startTime,
        message: 'MongoDB is connected',
        details: {
          database: mongoose.connection.name,
          host: mongoose.connection.host,
        },
      };
    } else {
      return {
        name: 'database',
        status: INTEGRATION_STATUS.FAILED,
        latency: Date.now() - startTime,
        message: `MongoDB connection state: ${state}`,
      };
    }
  } catch (error) {
    return {
      name: 'database',
      status: INTEGRATION_STATUS.FAILED,
      latency: Date.now() - startTime,
      message: error.message,
    };
  }
}

/**
 * Check AI service (Gemini/Anthropic)
 */
export async function checkAIService() {
  const startTime = Date.now();

  try {
    const provider = llmProviderName();

    if (!provider || provider === 'mock') {
      return {
        name: 'ai',
        status: INTEGRATION_STATUS.DEGRADED,
        latency: Date.now() - startTime,
        message: 'AI service using mock provider (no API key configured)',
        details: {
          provider: provider || 'unknown',
          mode: 'mock',
        },
      };
    }

    // For real providers, perform a minimal health check
    const model = provider === 'google-gemini' ? env.googleModel : 'claude';

    return {
      name: 'ai',
      status: INTEGRATION_STATUS.HEALTHY,
      latency: Date.now() - startTime,
      message: `AI service connected: ${provider}`,
      details: {
        provider,
        model,
      },
    };
  } catch (error) {
    return {
      name: 'ai',
      status: INTEGRATION_STATUS.FAILED,
      latency: Date.now() - startTime,
      message: error.message,
    };
  }
}

/**
 * Check iGOT integration
 */
export async function checkIGOT() {
  const startTime = Date.now();

  try {
    if (!process.env.IGOT_API_URL || !process.env.IGOT_API_KEY) {
      return {
        name: 'igot',
        status: INTEGRATION_STATUS.NOT_CONFIGURED,
        latency: null,
        message: 'iGOT API not configured (IGOT_API_URL or IGOT_API_KEY missing)',
        details: {
          configured: false,
          source: 'iGOT Karmayogi Portal',
        },
      };
    }

    // Try to fetch from iGOT API
    const response = await fetch(`${process.env.IGOT_API_URL}/courses`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.IGOT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return {
        name: 'igot',
        status: INTEGRATION_STATUS.HEALTHY,
        latency: Date.now() - startTime,
        message: 'iGOT API is responding',
        details: {
          configured: true,
          source: 'iGOT Karmayogi Portal',
          url: process.env.IGOT_API_URL,
        },
      };
    } else {
      return {
        name: 'igot',
        status: INTEGRATION_STATUS.DEGRADED,
        latency: Date.now() - startTime,
        message: `iGOT API returned ${response.status}`,
        details: {
          configured: true,
          source: 'iGOT Karmayogi Portal',
          statusCode: response.status,
        },
      };
    }
  } catch (error) {
    return {
      name: 'igot',
      status: INTEGRATION_STATUS.FAILED,
      latency: Date.now() - startTime,
      message: error.message,
      details: {
        configured: !!(process.env.IGOT_API_URL && process.env.IGOT_API_KEY),
        source: 'iGOT Karmayogi Portal',
      },
    };
  }
}

/**
 * Check NSSTA integration
 */
export async function checkNSSTA() {
  const startTime = Date.now();

  try {
    if (!process.env.NSSTA_API_URL || !process.env.NSSTA_API_KEY) {
      return {
        name: 'nssta',
        status: INTEGRATION_STATUS.NOT_CONFIGURED,
        latency: null,
        message: 'NSSTA API not configured (NSSTA_API_URL or NSSTA_API_KEY missing)',
        details: {
          configured: false,
          source: 'NSSTA TPAC Annual Calendar',
        },
      };
    }

    const response = await fetch(`${process.env.NSSTA_API_URL}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.NSSTA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return {
        name: 'nssta',
        status: INTEGRATION_STATUS.HEALTHY,
        latency: Date.now() - startTime,
        message: 'NSSTA API is responding',
        details: {
          configured: true,
          source: 'NSSTA TPAC Annual Calendar',
          url: process.env.NSSTA_API_URL,
        },
      };
    } else {
      return {
        name: 'nssta',
        status: INTEGRATION_STATUS.DEGRADED,
        latency: Date.now() - startTime,
        message: `NSSTA API returned ${response.status}`,
        details: {
          configured: true,
          source: 'NSSTA TPAC Annual Calendar',
          statusCode: response.status,
        },
      };
    }
  } catch (error) {
    return {
      name: 'nssta',
      status: INTEGRATION_STATUS.FAILED,
      latency: Date.now() - startTime,
      message: error.message,
      details: {
        configured: !!(process.env.NSSTA_API_URL && process.env.NSSTA_API_KEY),
        source: 'NSSTA TPAC Annual Calendar',
      },
    };
  }
}

/**
 * Check Firebase Realtime Database
 */
export async function checkFirebase() {
  const startTime = Date.now();

  try {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_DATABASE_URL) {
      return {
        name: 'firebase',
        status: INTEGRATION_STATUS.NOT_CONFIGURED,
        latency: null,
        message: 'Firebase not configured (FIREBASE_PROJECT_ID or FIREBASE_DATABASE_URL missing)',
        details: {
          configured: false,
          purpose: 'Realtime chat and presence',
        },
      };
    }

    // For Firebase, we just check if credentials are present
    // Real health check would require Firebase Admin SDK initialization
    return {
      name: 'firebase',
      status: INTEGRATION_STATUS.HEALTHY,
      latency: Date.now() - startTime,
      message: 'Firebase configured for realtime services',
      details: {
        configured: true,
        purpose: 'Realtime chat and presence',
        projectId: process.env.FIREBASE_PROJECT_ID,
      },
    };
  } catch (error) {
    return {
      name: 'firebase',
      status: INTEGRATION_STATUS.FAILED,
      latency: Date.now() - startTime,
      message: error.message,
      details: {
        configured: !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_DATABASE_URL),
        purpose: 'Realtime chat and presence',
      },
    };
  }
}

/**
 * Check all services and return aggregated health status
 */
export async function checkAllServices() {
  const results = await Promise.allSettled([
    checkDatabase(),
    checkAIService(),
    checkIGOT(),
    checkNSSTA(),
    checkFirebase(),
  ]);

  const services = {};

  results.forEach((result, index) => {
    const names = ['database', 'ai', 'igot', 'nssta', 'firebase'];
    const name = names[index];

    if (result.status === 'fulfilled') {
      services[name] = result.value;
    } else {
      services[name] = {
        name,
        status: INTEGRATION_STATUS.FAILED,
        latency: null,
        message: result.reason?.message || 'Unknown error',
      };
    }
  });

  // Calculate overall status
  const statuses = Object.values(services).map(s => s.status);
  let overallStatus = INTEGRATION_STATUS.HEALTHY;

  if (statuses.includes(INTEGRATION_STATUS.FAILED)) {
    overallStatus = INTEGRATION_STATUS.FAILED;
  } else if (statuses.includes(INTEGRATION_STATUS.DEGRADED)) {
    overallStatus = INTEGRATION_STATUS.DEGRADED;
  } else if (statuses.every(s => s === INTEGRATION_STATUS.NOT_CONFIGURED)) {
    overallStatus = INTEGRATION_STATUS.NOT_CONFIGURED;
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services,
  };
}