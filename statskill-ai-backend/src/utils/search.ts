import { Model, FilterQuery } from 'mongoose';
import { escapeRegex } from '../services/course/course.service';

/**
 * Portable multi-field keyword search:
 *   1. Tries the native { $or: [field: /q/i] } query (indexed on MongoDB).
 *   2. If it yields nothing, falls back to an in-memory scan over a bounded
 *      set — keeps search working on MongoDB-compatible fallback stores that
 *      don't implement $or/regex projection.
 */
export const multiFieldSearch = async <T extends { _id: unknown }>(
  model: Model<T>,
  fields: (keyof T & string)[],
  query: string,
  opts: { limit?: number; baseFilter?: FilterQuery<T>; scanCap?: number; select?: string | Record<string, number> } = {}
): Promise<T[]> => {
  const rx = new RegExp(escapeRegex(query), 'i');
  const baseFilter = opts.baseFilter ?? {};
  const limit = opts.limit ?? 10;
  const scanCap = opts.scanCap ?? 2000;

  try {
    const viaQuery = await model
      .find({ ...baseFilter, $or: fields.map((f) => ({ [f]: rx })) } as FilterQuery<T>)
      .limit(limit)
      .select(opts.select ?? {});
    if (viaQuery.length > 0) return viaQuery;
  } catch {
    // fall through to in-memory scan
  }

  const pool = await model.find(baseFilter).limit(scanCap).select(opts.select ?? {});
  const matches = pool.filter((doc) => {
    const source = doc.toObject() as Record<string, unknown>;
    return fields.some((f) => {
      const value = source[f];
      if (typeof value === 'string') return rx.test(value);
      if (Array.isArray(value)) return value.some((v) => typeof v === 'string' && rx.test(v));
      return false;
    });
  });
  return matches.slice(0, limit) as T[];
};
