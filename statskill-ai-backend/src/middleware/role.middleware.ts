import { Request, Response, NextFunction } from 'express';
import { forbidden, unauthorized } from '../utils/errors';
import { UserRole } from '../models/User';

/**
 * RBAC guard. Usage: router.get('/admin', authenticate, requireRole('ADMIN'), handler)
 * or requireRole('TRAINER', 'ADMIN').
 */
export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden(`This endpoint requires role: ${roles.join(' or ')}`));
    }
    next();
  };
