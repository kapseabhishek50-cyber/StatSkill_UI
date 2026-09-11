import { AuditLog } from '../models/AuditLog.js';

/**
 * Records an access after the response is sent, so logging never delays or
 * fails the request. Attach to routes that read or write personnel data.
 *
 *   router.get('/heatmap', requireAuth, requireRole('admin'),
 *              audit('admin.heatmap.read'), handler)
 */
export function audit(action, options = {}) {
  const { targetType, targetIdFrom } = options;

  return function auditMiddleware(req, res, next) {
    res.on('finish', () => {
      // Only log what actually succeeded; failures are already in the error log.
      if (res.statusCode >= 400) return;

      AuditLog.create({
        actor: req.user?._id,
        actorRole: req.user?.role,
        action,
        targetType,
        targetId: targetIdFrom ? String(req.params[targetIdFrom] ?? '') : undefined,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        statusCode: res.statusCode,
      }).catch((error) => console.error('[audit] write failed:', error.message));
    });

    next();
  };
}
