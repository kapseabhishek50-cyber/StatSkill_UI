import { Schema, model, models, Model, Document, Types } from 'mongoose';

export type MaterialStatus = 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';

export interface IMaterial extends Document {
  title: string;
  description?: string;
  uploadedBy: Types.ObjectId;
  filename: string; // stored filename (sanitized)
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  fileType: 'PDF' | 'DOCX' | 'PPTX' | 'TXT';
  status: MaterialStatus;
  extractedChars: number;
  chunkCount: number;
  error?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const materialSchema = new Schema<IMaterial>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    storagePath: { type: String, required: true },
    fileType: { type: String, enum: ['PDF', 'DOCX', 'PPTX', 'TXT'], required: true },
    status: { type: String, enum: ['UPLOADED', 'PROCESSING', 'READY', 'FAILED'], default: 'UPLOADED', index: true },
    extractedChars: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    error: { type: String },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const Material: Model<IMaterial> = models.Material || model<IMaterial>('Material', materialSchema);
export default Material;
