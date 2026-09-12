import { Request } from 'express';
import { AuditLog } from '../models/AuditLog';
import { logger } from '../utils/logger';

const log = logger;

/**
 * Fire-and-forget audit logging (prompt §44). Never blocks or fails the
 * request; sensitive fields must not be passed in metadata.
 */
export const audit = async (
  req: Request | null,
  action: string,
  resource?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> => {
  try {
    await AuditLog.create({
      userId: req?.user?.id,
      action,
      resource,
      resourceId,
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
      metadata,
      timestamp: new Date(),
    });
  } catch (err) {
    log.warn({ err: (err as Error).message, action }, 'audit log write failed');
  }
};

/** Middleware wrapper: audited(action, resource) around sensitive handlers. */
export const audited =
  (action: string, resource: string, getResourceId?: (req: Request) => string | undefined) =>
  (req: Request, _res: unknown, next: (err?: unknown) => void): void => {
    void audit(req, action, resource, getResourceId?.(req));
    next();
  };
