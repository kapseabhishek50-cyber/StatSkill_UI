import mongoose from 'mongoose';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '../config/env.js';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

/** Wraps an async route handler so rejections reach the error handler. */
export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function notFound(req, _res, next) {
  next(new HttpError(404, `No route matches ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity.
export function errorHandler(error, req, res, next) {
  let status = error.status ?? 500;
  let message = error.message ?? 'Unexpected server error.';
  let details = error.details;

  if (error instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Validation failed.';
    details = Object.fromEntries(
      Object.entries(error.errors).map(([field, e]) => [field, e.message]),
    );
  } else if (error instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Malformed value for ${error.path}.`;
  } else if (error instanceof ZodError) {
    status = 400;
    message = 'Request validation failed.';
    details = error.flatten().fieldErrors;
  } else if (error instanceof multer.MulterError) {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = error.code === 'LIMIT_FILE_SIZE' ? 'The uploaded file is too large.' : 'The upload could not be read.';
  } else if (error.code === 11000) {
    status = 409;
    message = 'That record already exists.';
    details = error.keyValue;
  }

  if (status >= 500) {
    console.error('[error]', error);
  }

  res.status(status).json({
    error: { message, ...(details ? { details } : {}) },
    // Stack traces leak file paths and internals - development only.
    ...(env.isProd ? {} : { stack: status >= 500 ? error.stack : undefined }),
  });
}
