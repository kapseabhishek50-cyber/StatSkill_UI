import { Schema, model, models, Model, Document, Types } from 'mongoose';

export interface IRoleRequirement {
  competencyId: Types.ObjectId;
  requiredScore: number;
  weight?: number; // importance of the competency to the role (0-1)
}

export interface IRole extends Document {
  name: string; // e.g. "Statistical Officer"
  code: string; // e.g. STATISTICAL_OFFICER
  description?: string;
  department?: string;
  requirements: IRoleRequirement[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Role → competency requirement matrix. Role matching in the recommendation
 * engine reads this collection — never hardcoded in services/controllers.
 */
const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    description: { type: String },
    department: { type: String, trim: true, index: true },
    requirements: [
      {
        competencyId: { type: Schema.Types.ObjectId, ref: 'Competency', required: true },
        requiredScore: { type: Number, required: true, min: 0, max: 100 },
        weight: { type: Number, min: 0, max: 1, default: 1 },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Role: Model<IRole> = models.Role || model<IRole>('Role', roleSchema);
export default Role;
