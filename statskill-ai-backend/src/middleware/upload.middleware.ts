import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import { env } from '../config/env';
import { badRequest } from '../utils/errors';

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.txt'] as const;
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/octet-stream', // some OSes send this for pptx/txt
]);

const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

const sanitizeFilename = (name: string): string => {
  const ext = path.extname(name).toLowerCase();
  const base = path
    .basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'file'}-${crypto.randomBytes(6).toString('hex')}${ext}`;
};

export const getFileType = (filename: string): 'PDF' | 'DOCX' | 'PPTX' | 'TXT' | null => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'PDF';
  if (ext === '.docx') return 'DOCX';
  if (ext === '.pptx') return 'PPTX';
  if (ext === '.txt') return 'TXT';
  return null;
};

/**
 * Learning material upload guard (prompt §37): extension + MIME + size +
 * filename sanitization. Files are stored outside any publicly served
 * directory and are never executed.
 */
export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb) => cb(null, uploadRoot),
    filename: (_req: Request, file: Express.Multer.File, cb) => cb(null, sanitizeFilename(file.originalname)),
  }),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
      return cb(badRequest(`File type "${ext}" not allowed. Allowed: PDF, DOCX, PPTX, TXT`));
    }
    if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(badRequest(`MIME type "${file.mimetype}" not allowed`));
    }
    cb(null, true);
  },
});
