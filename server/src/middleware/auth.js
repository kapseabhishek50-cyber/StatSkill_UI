import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { HttpError } from './errorHandler.js';

export function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

function readBearer(req) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/** Authentication: proves who the caller is. Attaches req.user. */
export async function requireAuth(req, _res, next) {
  try {
    const token = readBearer(req);
    if (!token) throw new HttpError(401, 'Authentication required.');

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw new HttpError(401, 'Session expired or token invalid.');
    }

    // Re-read the user each request: a revoked account or a role change must
    // take effect immediately, not when the token happens to expire.
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) throw new HttpError(401, 'Account is inactive.');

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Authorization: proves the caller is allowed to do this.
 * Server-side and per-route - hiding a screen in the client is not access control.
 */
export function requireRole(...roles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) return next(new HttpError(401, 'Authentication required.'));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have access to this resource.'));
    }
    next();
  };
}

/**
 * Learners may only touch their own records; admins may touch anyone's.
 * Use on every route that takes a :userId.
 */
export function requireSelfOrAdmin(paramName = 'userId') {
  return function ownershipGuard(req, _res, next) {
    if (!req.user) return next(new HttpError(401, 'Authentication required.'));
    const target = req.params[paramName];
    if (req.user.role === 'admin' || target === 'me' || target === String(req.user._id)) {
      return next();
    }
    next(new HttpError(403, 'You may only access your own record.'));
  };
}

/** Resolves the 'me' alias to the authenticated user's id. */
export function resolveUserId(req, paramName = 'userId') {
  const raw = req.params[paramName];
  return !raw || raw === 'me' ? String(req.user._id) : raw;
}
