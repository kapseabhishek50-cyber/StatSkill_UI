import { Schema, model, models, Model, Document } from 'mongoose';
import { CompetencyCategory } from '../config/competency';

export interface ICompetency extends Document {
  code: string; // e.g. AI_ML
  name: string; // e.g. "AI/ML"
  category: CompetencyCategory;
  description?: string;
  keywords: string[]; // used for topic → competency mapping and semantic hints
  defaultRequiredScore: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Competency taxonomy (prompt §4). Seeded from config, editable by admins. */
const competencySchema = new Schema<ICompetency>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    category: {
      type: String,
      enum: ['STATISTICAL', 'TECHNICAL', 'DIGITAL_GOVERNANCE', 'BEHAVIOURAL'],
      required: true,
      index: true,
    },
    description: { type: String },
    keywords: { type: [String], default: [] },
    defaultRequiredScore: { type: Number, default: 60, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

competencySchema.index({ name: 'text', keywords: 'text' });

export const Competency: Model<ICompetency> = models.Competency || model<ICompetency>('Competency', competencySchema);
export default Competency;
