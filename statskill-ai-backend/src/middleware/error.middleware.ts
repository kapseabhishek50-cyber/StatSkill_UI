import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { sendErrorBody } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const log = logger;

interface ErrorBody {
  success: false;
  message: string;
  code: string;
  errors?: unknown;
  stack?: string;
}

/** Central error handler — always emits the standard error envelope. */
export const errorMiddleware = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Unable to process request';
  let errors: unknown;

  if (err instanceof AppError) {
    status = err.statusCode;
    code = err.code;
    message = err.message;
    errors = err.details;
  } else if (err instanceof ZodError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    errors = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'BAD_REQUEST';
    message = `Invalid value for ${err.path}`;
  } else if (typeof (err as { code?: number }).code === 'number' && (err as { code: number }).code === 11000) {
    status = 409;
    code = 'CONFLICT';
    message = 'A record with these unique values already exists';
  } else if (err instanceof Error && err.message.includes('rate limit')) {
    status = 429;
    code = 'RATE_LIMITED';
    message = err.message;
  }

  if (status >= 500) {
    log.error({ err: err instanceof Error ? { message: err.message, stack: err.stack } : err, requestId: req.requestId, endpoint: req.originalUrl }, 'Unhandled error');
  } else {
    log.warn({ code, status, message, requestId: req.requestId, endpoint: req.originalUrl }, 'Request error');
  }

  const body: ErrorBody = { success: false, message, code, errors: errors ?? [] };
  if (!env.isProduction && status >= 500 && err instanceof Error) body.stack = err.stack;
  res.status(status).json(body);
};

/** 404 for unknown API routes. */
export const notFoundMiddleware = (req: Request, res: Response): void => {
  res.status(404).json(sendErrorBody(`Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));
};
