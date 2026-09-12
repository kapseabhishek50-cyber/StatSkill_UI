import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError } from './errors';

/** Standard success envelope. */
export const sendSuccess = (
  res: Response,
  data: unknown,
  message = 'Success',
  statusCode = 200
): Response => res.status(statusCode).json({ success: true, data, message });

/** Standard error envelope. */
export const sendErrorBody = (message: string, code: string, errors?: unknown) => ({
  success: false,
  message,
  code,
  errors: errors ?? [],
});

/** Wraps async route handlers so rejections reach the error middleware (Express 4). */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
