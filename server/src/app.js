import dns from "dns";
dns.setServers([
    '1.1.1.1',
    '8.8.8.8'
]);


import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { env } from './config/env.js';

/**
 * The Express app, separated from the listener so tests can import it without
 * binding a port.
 *
 * CORS is allow-listed to the configured client origin rather than '*'. In
 * development the Vite dev server proxies /api, so requests are same-origin and
 * never reach the CORS layer at all - the allow-list is for a deployed client on
 * a different host.
 */

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API serves JSON only; a CSP here would constrain nothing and mislead.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(
    cors({
      origin: env.clientOrigin === '*' ? true : env.clientOrigin.split(',').map((o) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // A blanket ceiling. Sign-in and generation have their own tighter limits.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { message: 'Too many requests. Slow down for a moment.' } },
    }),
  );

  app.use('/api', routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
