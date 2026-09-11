import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    designation: { type: String, trim: true },
    cadre: { type: String, trim: true },
    postingLocation: { type: String, trim: true },
    experienceYears: { type: Number, min: 0, default: 0 },
    joinedOn: Date,
    qualifications: [{ type: String, trim: true }],
    languages: [{ type: String, trim: true }],

    /**
     * Skills the LLM lifted out of an uploaded CV / service record, before any
     * mapping to the competency framework. Kept separate from UserCompetency:
     * this is raw extraction, that is a governed level.
     */
    extractedSkills: [
      {
        _id: false,
        term: String,
        // Competency this term was mapped to, when the mapper found one.
        competency: { type: mongoose.Schema.Types.ObjectId, ref: 'Competency' },
        confidence: { type: Number, min: 0, max: 1 },
        // Level the document supports, and the sentence it was read from. Stored
        // so a suggestion can be checked against its source rather than trusted.
        impliedLevel: { type: Number, min: 0, max: 5 },
        evidence: String,
      },
    ],

    sourceDocuments: [
      {
        _id: false,
        filename: String,
        mimeType: String,
        sizeBytes: Number,
        uploadedAt: { type: Date, default: Date.now },
        // Extracted text is stored once at upload so no read path re-runs the LLM.
        textLength: Number,
      },
    ],
  },
  { timestamps: true, collection: 'profiles' },
);

export const Profile = mongoose.model('Profile', profileSchema);
