import { Schema, model, models, Model, Document } from 'mongoose';

export type CourseSource = 'IGOT' | 'NSSTA' | 'MOSPI' | 'INTERNAL' | 'MOCK' | 'EXTERNAL';
export type CourseLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type SyncStatus = 'NEVER' | 'OK' | 'STALE' | 'FAILED';

export interface ICourse extends Document {
  title: string;
  description: string;
  provider: string; // display name e.g. "iGOT Karmayogi"
  source: CourseSource;
  externalId?: string;
  url?: string;
  category: string;
  skills: string[]; // competency codes this course teaches
  level: CourseLevel;
  durationHours: number;
  language: string;
  tags: string[];
  learningObjectives: string[];
  eligibility?: string;
  modules: { title: string; description?: string; durationMinutes: number }[];
  thumbnail?: string;
  rating: number;
  enrollmentCount: number;
  isActive: boolean;
  lastSyncedAt?: Date;
  syncStatus: SyncStatus;
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const moduleSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    durationMinutes: { type: Number, default: 30 },
  },
  { _id: false }
);

const courseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true, index: true },
    description: { type: String, required: true },
    provider: { type: String, required: true, index: true },
    source: { type: String, enum: ['IGOT', 'NSSTA', 'MOSPI', 'INTERNAL', 'MOCK', 'EXTERNAL'], default: 'INTERNAL', index: true },
    externalId: { type: String, trim: true, index: true },
    url: { type: String },
    category: { type: String, required: true, trim: true, index: true },
    skills: { type: [String], default: [], index: true }, // competency codes
    level: { type: String, enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], default: 'BEGINNER', index: true },
    durationHours: { type: Number, default: 4, min: 0 },
    language: { type: String, default: 'en' },
    tags: { type: [String], default: [], index: true },
    learningObjectives: { type: [String], default: [] },
    eligibility: { type: String },
    modules: { type: [moduleSchema], default: [] },
    thumbnail: { type: String },
    rating: { type: Number, default: 4, min: 0, max: 5 },
    enrollmentCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    lastSyncedAt: { type: Date },
    syncStatus: { type: String, enum: ['NEVER', 'OK', 'STALE', 'FAILED'], default: 'NEVER' },
    syncError: { type: String },
  },
  { timestamps: true }
);

// Dedupe on (source, externalId) when an externalId exists.
courseSchema.index({ source: 1, externalId: 1 }, { unique: true, sparse: true });
courseSchema.index({ title: 'text', description: 'text', tags: 'text' });
courseSchema.index({ skills: 1, level: 1, isActive: 1 });

export const Course: Model<ICourse> = models.Course || model<ICourse>('Course', courseSchema);
export default Course;
