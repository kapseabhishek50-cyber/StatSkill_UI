import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import routes from './routes';
import { globalLimiter } from './middleware/rateLimit.middleware';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { logger } from './utils/logger';
import { openApiSpec } from './docs/openapi';
import swaggerUi from 'swagger-ui-express';
import crypto from 'crypto';

const log = logger;

export const createApp = (): Express => {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // ---- security & parsing ----
  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction ? undefined : false,
    })
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser/no-origin requests (curl, health checks) always pass.
        if (!origin) return callback(null, true);
        if (env.isProduction) {
          // Production: configured origins only.
          if (env.clientOrigins.includes(origin) || env.clientOrigins.includes('*')) return callback(null, true);
          return callback(null, false);
        }
        // Development/preview: permissive.
        return callback(null, true);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ---- request id + structured request logging ----
  app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    const start = Date.now();
    res.on('finish', () => {
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      log[level](
        {
          requestId: req.requestId,
          userId: req.user?.id,
          method: req.method,
          endpoint: req.originalUrl,
          status: res.statusCode,
          latencyMs: Date.now() - start,
        },
        'request'
      );
    });
    next();
  });

  // ---- global rate limit ----
  app.use('/api', globalLimiter);

  // ---- API docs (OpenAPI + Swagger UI) ----
  app.get('/api/docs.json', (_req, res) => res.json(openApiSpec));
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'StatSkill AI API Docs',
    })
  );

  // ---- routes ----
  app.use('/api', routes);

  // ---- uploads are served only via explicit material endpoints, never statically ----

  // ---- errors ----
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};
