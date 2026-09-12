import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { unprocessable } from '../utils/errors';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Zod request validation. Parsed (coerced/trimmed) values replace the raw ones
 * so controllers always work with validated data.
 */
export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        // Replace query while keeping Express's read-only contract for consumers.
        Object.defineProperty(req, 'query', {
          value: parsed,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params);
        Object.defineProperty(req, 'params', {
          value: parsed,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          unprocessable(
            'Validation failed',
            err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
          )
        );
      } else next(err);
    }
  };
