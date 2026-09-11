import mongoose from 'mongoose';

/**
 * Who did what. Personnel competency data is sensitive, so every admin read of
 * workforce-wide analytics and every write to someone else's competency record
 * lands here. Capped so an unbounded log cannot fill the database.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: String,
    action: { type: String, required: true, index: true },
    targetType: String,
    targetId: String,
    method: String,
    path: String,
    ip: String,
    statusCode: Number,
    meta: mongoose.Schema.Types.Mixed,
    at: { type: Date, default: Date.now, index: true },
  },
  {
    collection: 'audit_logs',
    capped: { size: 32 * 1024 * 1024, max: 200000 },
    versionKey: false,
  },
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
