import { Schema, model, models, Model, Document, Types } from 'mongoose';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'REGISTER'
  | 'REFRESH'
  | 'ASSESSMENT_COMPLETED'
  | 'QUIZ_CREATED'
  | 'QUIZ_PUBLISHED'
  | 'COURSE_CREATED'
  | 'COURSE_UPDATED'
  | 'COURSE_SYNC'
  | 'MATERIAL_UPLOADED'
  | 'RECOMMENDATION_GENERATED'
  | 'ROLE_CHANGED'
  | 'USER_UPDATED'
  | 'COMMUNITY_CREATED'
  | 'AI_CALL';

export interface IAuditLog extends Document {
  userId?: Types.ObjectId;
  action: AuditAction | string;
  resource?: string;
  resourceId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    resource: { type: String },
    resourceId: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false, capped: { size: 50 * 1024 * 1024, max: 200000 } }
);

export const AuditLog: Model<IAuditLog> = models.AuditLog || model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLog;
