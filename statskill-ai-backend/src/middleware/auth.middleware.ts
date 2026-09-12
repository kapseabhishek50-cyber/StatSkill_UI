import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from '../utils/errors';
import { User, UserRole } from '../models/User';

export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

// Unique token id — guarantees each issued token is distinct even within the
// same second, which refresh-token rotation depends on.
const jti = (): string => crypto.randomUUID();

export const signAccessToken = (payload: { uid: string; role: UserRole }): string =>
  jwt.sign({ ...payload, jti: jti() }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);

export const signRefreshToken = (payload: { uid: string; role: UserRole }): string =>
  jwt.sign({ ...payload, jti: jti() }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);

export const verifyAccessToken = (token: string): { uid: string; role: UserRole } =>
  jwt.verify(token, env.JWT_SECRET) as { uid: string; role: UserRole };

export const verifyRefreshToken = (token: string): { uid: string; role: UserRole } =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as { uid: string; role: UserRole };

/** Requires a valid Bearer token; attaches req.user. */
export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized('Missing or malformed Authorization header');
    const token = header.slice(7).trim();
    let decoded: { uid: string; role: UserRole };
    try {
      decoded = verifyAccessToken(token);
    } catch {
      throw unauthorized('Invalid or expired token');
    }
    const user = await User.findById(decoded.uid).select('role isActive name email');
    if (!user || !user.isActive) throw unauthorized('Account not found or deactivated');
    req.user = { id: String(user._id), role: user.role, email: user.email, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
};

/** Optional auth: attaches req.user when a valid token is present, else continues. */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const decoded = verifyAccessToken(header.slice(7).trim());
      User.findById(decoded.uid)
        .select('role isActive name email')
        .then((user) => {
          if (user?.isActive) {
            req.user = { id: String(user._id), role: user.role, email: user.email, name: user.name };
          }
          next();
        })
        .catch(() => next());
      return;
    } catch {
      // fall through — anonymous
    }
  }
  next();
};
