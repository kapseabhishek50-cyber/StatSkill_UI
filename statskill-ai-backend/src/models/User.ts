import { Schema, model, models, Model, Document, Types } from 'mongoose';

export type UserRole = 'LEARNER' | 'TRAINER' | 'ADMIN';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  employeeId?: string;
  role: UserRole;
  designation?: string;
  department?: string;
  organization?: string;
  experience?: number; // years
  education?: string;
  preferredLanguage?: string;
  avatar?: string;
  interests?: string[];
  learningGoals?: string[];
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
    department: { type: String, trim: true, index: true },
    organization: { type: String, trim: true },
    experience: { type: Number, min: 0, max: 50 },
    education: { type: String, trim: true },
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
