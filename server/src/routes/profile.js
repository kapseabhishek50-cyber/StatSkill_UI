import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Competency, JobRole, Profile, UserCompetency } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../middleware/errorHandler.js';
import { UnsupportedDocument, extractText } from '../services/docExtract.js';
import { extractSkills } from '../services/llm/index.js';
import { env } from '../config/env.js';

/**
 * Profile, uploaded documents, and the officer's own competency record.
 *
 * Uploads are held in memory and never written to disk: the text is what we want,
 * the file itself has no further use, and a server that does not store uploads has
 * no upload directory to traverse, fill, or leak.
 */

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 1 },
});

const profilePatch = z.object({
  designation: z.string().max(120).optional(),
  cadre: z.string().max(120).optional(),
  postingLocation: z.string().max(160).optional(),
  experienceYears: z.number().min(0).max(60).optional(),
  joinedOn: z.coerce.date().optional(),
  qualifications: z.array(z.string().max(120)).max(20).optional(),
  languages: z.array(z.string().max(60)).max(20).optional(),
});

/** One profile per user, created on demand so a seeded user is never missing one. */
async function ownProfile(userId) {
  return Profile.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId } },
    { new: true, upsert: true },
  ).populate('extractedSkills.competency', 'code name category');
}

router.use(requireAuth);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json({ profile: await ownProfile(req.user._id) });
  }),
);

router.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const parsed = profilePatch.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Check the details you entered.', parsed.error.flatten().fieldErrors);
    }

    // Only whitelisted fields reach the update: extractedSkills and
    // sourceDocuments are written by the extraction path, not by the client.
    await Profile.updateOne({ user: req.user._id }, { $set: parsed.data }, { upsert: true });
    res.json({ profile: await ownProfile(req.user._id) });
  }),
);

/**
 * Upload -> extract text -> ask the model which competencies the text supports.
 *
 * Extraction produces *suggestions*, mapped to the framework where the term
 * matches. It never writes a level: a CV saying "expert in sampling" is a claim,
 * and levels come from the assessment and from quizzes.
 */
router.post(
  '/me/documents',
  upload.single('document'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Attach a PDF, DOCX, or PPTX file.');

    let extracted;
    try {
      extracted = await extractText(req.file);
    } catch (error) {
      if (error instanceof UnsupportedDocument) throw new HttpError(415, error.message);
      throw new HttpError(422, `Could not read that document: ${error.message}`);
    }

    if (extracted.chars < 40) {
      throw new HttpError(422, 'No readable text in that file. A scanned image needs OCR first.');
    }

    const competencies = await Competency.find().select('code name category').lean();
    const result = await extractSkills({
      documentText: extracted.text,
      competencyList: competencies.map((c) => ({ name: c.name, code: c.code })),
    });

    const byName = new Map(competencies.map((c) => [c.name.toLowerCase(), c._id]));
    const skills = (result.skills ?? []).map((skill) => ({
      term: skill.term,
      competency: byName.get(String(skill.term).toLowerCase()) ?? null,
      confidence: skill.confidence,
      impliedLevel: skill.impliedLevel,
      evidence: skill.evidence,
    }));

    const update = {
      $set: { extractedSkills: skills },
      $push: {
        sourceDocuments: {
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          textLength: extracted.chars,
        },
      },
    };

    // Details the document supplies are filled in, never overwritten: what the
    // officer typed about their own service outranks what a parser inferred.
    const current = await Profile.findOne({ user: req.user._id }).lean();
    if (result.experienceYears && !current?.experienceYears) {
      update.$set.experienceYears = result.experienceYears;
    }
    if (result.qualifications?.length && !current?.qualifications?.length) {
      update.$set.qualifications = result.qualifications;
    }

    await Profile.updateOne({ user: req.user._id }, update, { upsert: true });

    res.json({
      profile: await ownProfile(req.user._id),
      extraction: {
        chars: extracted.chars,
        truncated: extracted.truncated,
        llmSource: result.llmSource,
      },
    });
  }),
);

/** The officer's recorded levels, newest change first. */
router.get(
  '/me/competencies',
  asyncHandler(async (req, res) => {
    const competencies = await UserCompetency.find({ user: req.user._id })
      .populate('competency', 'code name category description')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ competencies });
  }),
);

/** What this officer's role requires - the self-assessment form is built from it. */
router.get(
  '/me/requirements',
  asyncHandler(async (req, res) => {
    if (!req.user.jobRole) return res.json({ requirements: [], jobRole: null });

    const role = await JobRole.findById(req.user.jobRole)
      .populate('requirements.competency', 'code name category description')
      .lean();

    const requirements = [...(role?.requirements ?? [])].sort(
      (a, b) => Number(b.mandatory) - Number(a.mandatory) || b.requiredLevel - a.requiredLevel,
    );

    res.json({
      requirements,
      jobRole: role ? { _id: role._id, code: role.code, title: role.title } : null,
    });
  }),
);

export default router;
