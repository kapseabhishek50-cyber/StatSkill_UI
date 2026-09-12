import fs from 'fs';
import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { User } from '../models/User';
import { unauthorized, notFound, badRequest } from '../utils/errors';
import { skillGapService } from '../services/skillGap/skillGap.service';
import { competencyService } from '../services/competency/competency.service';
import { recommendationJob } from '../jobs/recommendation.job';
import { audit } from '../middleware/audit.middleware';
import { buildUserProfileText } from '../services/recommendation/semantic.service';
import { extractText, cleanText, FileType } from '../services/material/textExtraction.service';
import { getFileType } from '../middleware/upload.middleware';
import { matchCompetencies } from '../services/profile/cvExtraction.service';

const PROFILE_FIELDS = [
  'name',
  'designation',
  'cadre',
  'department',
  'postingLocation',
  'organization',
  'experience',
  'education',
  'qualifications',
  'preferredLanguage',
  'avatar',
  'interests',
  'learningGoals',
] as const;

/** Profile view: service details + CV-derived suggestions, with competencies joined. */
const presentProfile = <T extends { experience?: number }>(user: T): T & { experienceYears?: number } => ({
  ...user,
  experienceYears: user.experience,
});

export const profileController = {
  getProfile: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id)
      .select('-passwordHash -refreshTokens')
      .populate('extractedSkills.competency', 'name code category');
    if (!user) throw unauthorized();
    const competencies = await competencyService.getUserCompetencies(req.user!.id);
    const plain = user.toObject();
    sendSuccess(res, { user: plain, profile: presentProfile(plain), competencies }, 'Profile');
  }),

  /** GET /api/profile/learning-profile — the semantic profile used by the recommender. */
  getLearningProfile: asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw unauthorized();
    const gaps = await skillGapService.listForUser(req.user!.id);
    const { Enrollment } = await import('../models/Enrollment');
    const completed = await Enrollment.find({ userId: user._id, status: 'COMPLETED' }).populate('courseId', 'title');
    const titles = completed.map((e) => (e.courseId as unknown as { title?: string }).title ?? '');
    sendSuccess(
      res,
      {
        learningProfileText: buildUserProfileText(user, gaps, titles),
        openGaps: gaps.filter((g) => g.gap > 0).slice(0, 8),
        completedCourses: titles,
      },
      'Learning profile'
    );
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const updates: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    // Frontend alias: experienceYears → experience.
    if (req.body.experienceYears !== undefined && updates.experience === undefined) {
      updates.experience = req.body.experienceYears;
    }
    const user = await User.findByIdAndUpdate(req.user!.id, { $set: updates }, { new: true })
      .select('-passwordHash -refreshTokens')
      .populate('extractedSkills.competency', 'name code category');
    if (!user) throw notFound('User not found');
    // Role-relevant profile fields changed → gaps/recs may shift.
    if (updates.designation || updates.department || updates.experience) {
      await skillGapService.recalculateForUser(req.user!.id);
      recommendationJob.enqueue(req.user!.id);
    }
    void audit(req, 'USER_UPDATED', 'user', req.user!.id, { fields: Object.keys(updates) });
    const plain = user.toObject();
    sendSuccess(res, { user: plain, profile: presentProfile(plain) }, 'Profile updated');
  }),

  /**
   * POST /api/profile/me/documents — learner CV upload (multipart field "document").
   * Text is extracted once, matched deterministically against the competency
   * taxonomy, and stored as *suggestions*. The uploaded file itself is deleted
   * immediately — only the filename record and suggestions are kept.
   */
  uploadDocument: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw badRequest('No file uploaded — send multipart/form-data with a "document" field');
    const fileType = getFileType(file.originalname) as FileType | null;
    if (!fileType) {
      fs.unlink(file.path, () => undefined);
      throw badRequest('Only PDF, DOCX, PPTX or TXT documents are accepted');
    }
    let text = '';
    try {
      text = cleanText(await extractText(file.path, fileType));
    } finally {
      fs.unlink(file.path, () => undefined);
    }
    if (text.trim().length < 50) {
      throw badRequest('Could not extract enough text — a scanned image needs OCR first');
    }
    const skills = await matchCompetencies(text);
    const user = await User.findByIdAndUpdate(
      req.user!.id,
      {
        $set: { extractedSkills: skills },
        $push: {
          sourceDocuments: {
            filename: file.originalname,
            uploadedAt: new Date(),
            chars: text.length,
          },
        },
      },
      { new: true }
    )
      .select('-passwordHash -refreshTokens')
      .populate('extractedSkills.competency', 'name code category');
    if (!user) throw notFound('User not found');
    void audit(req, 'CV_UPLOADED', 'user', req.user!.id, { filename: file.originalname, chars: text.length, matches: skills.length });
    const plain = user.toObject();
    sendSuccess(res, { user: plain, profile: presentProfile(plain), matchedSkills: skills.length }, 'Document processed');
  }),

  /** GET /api/profile/me/competencies — every measured competency on the 0-5 display scale. */
  myCompetencies: asyncHandler(async (req: Request, res: Response) => {
    const rows = await competencyService.getUserCompetencies(req.user!.id);
    const competencies = rows.map((r) => ({
      competency: r.competency
        ? { _id: r.competency._id, name: r.competency.name, category: r.competency.category, code: r.competency.code }
        : { _id: r.competencyId },
      currentLevel: Math.max(0, Math.min(5, Math.round(r.currentScore / 20))),
      currentScore: r.currentScore,
      requiredScore: r.requiredScore,
      source: r.source,
      confidence: r.confidence,
      lastAssessedAt: r.lastAssessedAt,
    }));
    sendSuccess(res, { competencies }, 'My competencies');
  }),

  /**
   * GET /api/profile/me/requirements — the role requirement matrix for the
   * officer's designation. Empty when no designation/role is set, so the UI
   * can prompt for profile setup instead of showing invented requirements.
   */
  myRequirements: asyncHandler(async (req: Request, res: Response) => {
    const { Role } = await import('../models/Role');
    const user = await User.findById(req.user!.id).select('designation');
    const designation = user?.designation?.trim();
    const role = designation
      ? (await Role.findOne({ name: designation, isActive: true })) ??
        (await Role.findOne({ name: new RegExp(designation.split(' ')[0], 'i'), isActive: true }))
      : null;
    if (!role) return sendSuccess(res, { requirements: [] }, 'Role requirements');
    await role.populate('requirements.competencyId', 'name code category description');
    const requirements = (role.requirements ?? []).map((r) => {
      const c = r.competencyId as unknown as { _id: unknown; name?: string; code?: string; category?: string; description?: string };
      const requiredLevel = Math.max(0, Math.min(5, Math.round(r.requiredScore / 20)));
      return {
        competency: c && typeof c === 'object' && 'name' in c
          ? { _id: c._id, name: c.name, code: c.code, category: c.category, description: c.description }
          : { _id: r.competencyId },
        requiredLevel,
        requiredScore: r.requiredScore,
        // Core requirements (≥70) are the role's must-haves.
        mandatory: r.requiredScore >= 70,
      };
    });
    sendSuccess(res, { requirements, role: { id: String(role._id), name: role.name, code: role.code } }, 'Role requirements');
  }),
};
