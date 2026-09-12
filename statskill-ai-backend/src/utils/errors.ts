/**
 * Central error types. Every error surfaced to a client goes through these so
 * the response envelope ({ success, message, code, errors }) stays consistent.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational = true;

  constructor(message: string, statusCode: number, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const badRequest = (message = 'Bad request', details?: unknown) =>
  new AppError(message, 400, 'BAD_REQUEST', details);

export const unauthorized = (message = 'Authentication required') =>
  new AppError(message, 401, 'AUTH_ERROR');

export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(message, 403, 'FORBIDDEN');

export const notFound = (message = 'Resource not found') =>
  new AppError(message, 404, 'NOT_FOUND');

export const conflict = (message = 'Resource already exists') =>
  new AppError(message, 409, 'CONFLICT');

export const unprocessable = (message = 'Validation failed', details?: unknown) =>
  new AppError(message, 422, 'VALIDATION_ERROR', details);

export const tooManyRequests = (message = 'Too many requests, please try again later') =>
  new AppError(message, 429, 'RATE_LIMITED');

/** Thrown when an AI provider call fails. Callers MUST degrade gracefully. */
export class AIUnavailableError extends AppError {
  constructor(message = 'AI provider is unavailable', details?: unknown) {
    super(message, 503, 'AI_UNAVAILABLE', details);
  }
}

/** Thrown when an external (iGOT/NSSTA/MoSPI) provider fails. */
export class ProviderError extends AppError {
  constructor(message = 'External provider failure', details?: unknown) {
    super(message, 502, 'PROVIDER_ERROR', details);
  }
}
