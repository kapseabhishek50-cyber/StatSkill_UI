import mongoose from 'mongoose';

const learningMaterialSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    filename: { type: String, required: true, trim: true },
    fileType: { type: String, enum: ['pdf', 'docx', 'pptx', 'txt'], required: true },
    sizeBytes: { type: Number, default: 0 },
    textLength: { type: Number, default: 0 },
    extractedText: { type: String },
    competency: { type: mongoose.Schema.Types.ObjectId, ref: 'Competency', required: true, index: true },
    targetLevel: { type: Number, min: 1, max: 5, default: 3 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    summary: { type: String, trim: true },
    generatedQuestions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    status: { type: String, enum: ['processed', 'error'], default: 'processed' },
  },
  { timestamps: true, collection: 'learning_materials' },
);

export const LearningMaterial = mongoose.model('LearningMaterial', learningMaterialSchema);

