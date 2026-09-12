import { Request } from 'express';
import { badRequest } from './errors';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sortField: string;
  sortOrder: 1 | -1;
}

const ALLOWED_SORT_FIELDS = new Set([
  'createdAt', 'updatedAt', 'title', 'name', 'matchScore', 'rating',
  'enrollmentCount', 'progress', 'score', 'currentScore', 'gap', 'priority',
  'lastActivityDate', 'publishedAt', 'membersCount', 'submittedAt', 'completedAt',
]);

export const parsePagination = (query: Request['query'], defaultLimit = 20): PaginationParams => {
  const page = Math.max(1, parseIntSafe(query.page as string, 1));
  let limit = parseIntSafe(query.limit as string, defaultLimit);
  if (limit < 1) limit = defaultLimit;
  if (limit > 100) limit = 100;
  let sortField = String(query.sort ?? 'createdAt');
  if (!ALLOWED_SORT_FIELDS.has(sortField)) sortField = 'createdAt';
  const order = String(query.order ?? 'desc').toLowerCase() === 'asc' ? 1 : -1;
  return { page, limit, skip: (page - 1) * limit, sortField, sortOrder: order };
};

export const mongoSort = (p: PaginationParams): Record<string, 1 | -1> => ({
  [p.sortField]: p.sortOrder,
  _id: p.sortOrder === 1 ? 1 : -1,
});

export const buildPagination = (total: number, p: { page: number; limit: number }) => ({
  page: p.page,
  limit: p.limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / p.limit)),
});

const parseIntSafe = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export const parseIdList = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string' && raw.length) return raw.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
};

export { badRequest };
