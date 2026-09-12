import { Course, ICourse } from '../../models/Course';
import { notFound, badRequest } from '../../utils/errors';
import { parsePagination, mongoSort, buildPagination } from '../../utils/pagination';
import { embeddingJob } from '../../jobs/embedding.job';
import { audit } from '../../middleware/audit.middleware';
import { Request } from 'express';

export const courseService = {
  async list(req: Request) {
    const p = parsePagination(req.query);
    const filter: Record<string, unknown> = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.provider) filter.provider = req.query.provider;
    if (req.query.level) filter.level = String(req.query.level).toUpperCase();
    if (req.query.source) filter.source = String(req.query.source).toUpperCase();
    if (req.query.skill) filter.skills = String(req.query.skill).toUpperCase();
    if (req.query.language) filter.language = req.query.language;
    if (req.query.isActive !== undefined) filter.isActive = String(req.query.isActive) === 'true';
    const [items, total] = await Promise.all([
      Course.find(filter).sort(mongoSort(p)).skip(p.skip).limit(p.limit),
      Course.countDocuments(filter),
    ]);
    return { items, pagination: buildPagination(total, p) };
  },

  async getById(id: string): Promise<ICourse> {
    const course = await Course.findById(id);
    if (!course) throw notFound('Course not found');
    return course;
  },

  async listByCategory(category: string, req: Request) {
    const p = parsePagination(req.query);
    const filter = { category: new RegExp(`^${escapeRegex(category)}$`, 'i') };
    const [items, total] = await Promise.all([
      Course.find(filter).sort(mongoSort(p)).skip(p.skip).limit(p.limit),
      Course.countDocuments(filter),
    ]);
    return { items, pagination: buildPagination(total, p) };
  },

  async listBySkill(skill: string, req: Request) {
    const p = parsePagination(req.query);
    const filter = { skills: skill.toUpperCase().replace(/[^A-Z0-9]+/g, '_') };
    const [items, total] = await Promise.all([
      Course.find(filter).sort(mongoSort(p)).skip(p.skip).limit(p.limit),
      Course.countDocuments(filter),
    ]);
    return { items, pagination: buildPagination(total, p) };
  },

  async create(input: Partial<ICourse>, actorId: string): Promise<ICourse> {
    if (!input.title || !input.description) throw badRequest('title and description are required');
    const course = await Course.create({ ...input, source: input.source ?? 'INTERNAL' });
    embeddingJob.enqueueCourse(String(course._id));
    void audit(null, 'COURSE_CREATED', 'course', String(course._id), { by: actorId, title: course.title });
    return course;
  },

  async update(id: string, input: Partial<ICourse>, actorId: string): Promise<ICourse> {
    const course = await Course.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true });
    if (!course) throw notFound('Course not found');
    // Content changed → re-embed in background (prompt §11).
    embeddingJob.enqueueCourse(id);
    void audit(null, 'COURSE_UPDATED', 'course', id, { by: actorId });
    return course;
  },

  async deactivate(id: string): Promise<ICourse> {
    const course = await Course.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!course) throw notFound('Course not found');
    return course;
  },

  async categories(): Promise<{ category: string; count: number }[]> {
    return Course.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $project: { _id: 0, category: '$_id', count: 1 } }, { $sort: { count: -1 } }]);
  },
};

export const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
