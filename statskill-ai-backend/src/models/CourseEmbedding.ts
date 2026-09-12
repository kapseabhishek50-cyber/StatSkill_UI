import { Schema, model, models, Model, Document, Types } from 'mongoose';

/**
 * Stored embedding for a course. Generated when a course is created/updated or
 * when the taxonomy changes — NEVER per request (prompt §11).
 */
export interface ICourseEmbedding extends Document {
  courseId: Types.ObjectId;
  provider: string;
  embeddingModel: string;
  dim: number;
  vector: number[];
  textHash: string; // hash of source text — re-embed only when this changes
  sourceText: string;
  updatedAt: Date;
  createdAt: Date;
}

const courseEmbeddingSchema = new Schema<ICourseEmbedding>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, unique: true, index: true },
    provider: { type: String, required: true },
    embeddingModel: { type: String, required: true },
    dim: { type: Number, required: true },
    vector: { type: [Number], required: true },
    textHash: { type: String, required: true },
    sourceText: { type: String },
  },
  { timestamps: true }
);

export const CourseEmbedding: Model<ICourseEmbedding> = models.CourseEmbedding || model<ICourseEmbedding>('CourseEmbedding', courseEmbeddingSchema);
export default CourseEmbedding;
