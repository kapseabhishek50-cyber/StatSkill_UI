import { Schema, model, models, Model, Document, Types } from 'mongoose';

/** A chunk of an uploaded material with its optional embedding (for RAG quiz generation / summarization). */
export interface IMaterialChunk extends Document {
  materialId: Types.ObjectId;
  index: number;
  text: string;
  embedding?: number[];
  embeddingProvider?: string;
  createdAt: Date;
}

const chunkSchema = new Schema<IMaterialChunk>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: 'Material', required: true, index: true },
    index: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number] },
    embeddingProvider: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

chunkSchema.index({ materialId: 1, index: 1 }, { unique: true });

export const MaterialChunk: Model<IMaterialChunk> = models.MaterialChunk || model<IMaterialChunk>('MaterialChunk', chunkSchema);
export default MaterialChunk;
