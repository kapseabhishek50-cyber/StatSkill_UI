import { Schema, model, models, Model, Document, Types } from 'mongoose';

export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'DROPPED';

export interface IEnrollment extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  status: EnrollmentStatus;
  progress: number; // 0-100
  timeSpentMinutes: number;
  currentModule: number; // index into Course.modules
  modulesCompleted: number[];
  startedAt: Date;
  lastAccessedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const enrollmentSchema = new Schema<IEnrollment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'DROPPED'], default: 'ACTIVE', index: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    timeSpentMinutes: { type: Number, default: 0, min: 0 },
    currentModule: { type: Number, default: 0, min: 0 },
    modulesCompleted: { type: [Number], default: [] },
    startedAt: { type: Date, default: Date.now },
    lastAccessedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ userId: 1, status: 1, lastAccessedAt: -1 });

export const Enrollment: Model<IEnrollment> = models.Enrollment || model<IEnrollment>('Enrollment', enrollmentSchema);
export default Enrollment;
