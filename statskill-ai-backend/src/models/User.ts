import { Schema, model, models, Model, Document, Types } from 'mongoose';

export type UserRole = 'LEARNER' | 'TRAINER' | 'ADMIN';

export interface IExtractedSkill {
  term: string;
  competency?: Types.ObjectId;
  impliedLevel: number; // 0-5 scale suggestion (never a recorded level)
  confidence: number; // 0-1
  evidence?: string;
}

export interface ISourceDocument {
  filename: string;
  uploadedAt: Date;
  chars?: number;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  employeeId?: string;
  role: UserRole;
  designation?: string;
  cadre?: string;
  department?: string;
  postingLocation?: string;
  organization?: string;
  experience?: number; // years
  education?: string;
  qualifications?: string[];
  preferredLanguage?: string;
  avatar?: string;
  interests?: string[];
  learningGoals?: string[];
  /** CV-derived skill suggestions (deterministic keyword match, not recorded levels). */
  extractedSkills: IExtractedSkill[];
  sourceDocuments: ISourceDocument[];
  xp: number;
  level: number;
  isActive: boolean;
  refreshTokens: { hash: string; expiresAt: Date; createdAt: Date }[];
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(plain: string): Promise<boolean>;
}

const refreshTokenSchema = new Schema(
  {
    hash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    employeeId: { type: String, trim: true, sparse: true, unique: true },
    role: { type: String, enum: ['LEARNER', 'TRAINER', 'ADMIN'], default: 'LEARNER', index: true },
    designation: { type: String, trim: true },
    cadre: { type: String, trim: true },
    department: { type: String, trim: true, index: true },
    postingLocation: { type: String, trim: true },
    organization: { type: String, trim: true },
    experience: { type: Number, min: 0, max: 50 },
    education: { type: String, trim: true },
    qualifications: { type: [String], default: [] },
    extractedSkills: {
      type: [
        {
          term: { type: String, required: true },
          competency: { type: Schema.Types.ObjectId, ref: 'Competency' },
          impliedLevel: { type: Number, min: 0, max: 5, default: 1 },
          confidence: { type: Number, min: 0, max: 1, default: 0.5 },
          evidence: { type: String },
        },
      ],
      default: [],
    },
    sourceDocuments: {
      type: [
        {
          filename: { type: String, required: true },
          uploadedAt: { type: Date, default: Date.now },
          chars: { type: Number },
        },
      ],
      default: [],
    },
    preferredLanguage: { type: String, default: 'en' },
    avatar: { type: String },
    interests: { type: [String], default: [] },
    learningGoals: { type: [String], default: [] },
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    isActive: { type: Boolean, default: true, index: true },
    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function (plain: string): Promise<boolean> {
  const bcrypt = (await import('bcryptjs')).default;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.pre('save', function (next) {
  // Keep refresh token list bounded.
  if (this.refreshTokens && this.refreshTokens.length > 10) {
    this.refreshTokens = this.refreshTokens.slice(-10);
  }
  next();
});

export const User: Model<IUser> = models.User || model<IUser>('User', userSchema);
export default User;
export const userIdSchema = Schema.Types.ObjectId;
