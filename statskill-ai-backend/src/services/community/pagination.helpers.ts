export { parsePagination, mongoSort, buildPagination } from '../../utils/pagination';

export const escapeRegexSafe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
