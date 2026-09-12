import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { materialService } from '../services/material/material.service';
import { badRequest } from '../utils/errors';
import fs from 'fs';

export const materialController = {
  /** POST /api/materials/upload (multipart field: "file") */
  upload: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw badRequest('No file uploaded — send multipart/form-data with a "file" field');
    if (!req.user) throw badRequest('Authentication required');
    const material = await materialService.registerUpload({
      title: (req.body?.title as string) || file.originalname.replace(/\.[^.]+$/, ''),
      description: req.body?.description,
      tags: typeof req.body?.tags === 'string' ? req.body.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : req.body?.tags,
      uploadedBy: req.user.id,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storagePath: file.path,
      fileType: file.filename.toLowerCase().endsWith('.pdf') ? 'PDF'
        : file.filename.toLowerCase().endsWith('.docx') ? 'DOCX'
        : file.filename.toLowerCase().endsWith('.pptx') ? 'PPTX'
        : 'TXT',
    });
    sendSuccess(res, { material }, 'Material uploaded — processing started', 202);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await materialService.listForTrainer(req.user!.id, req);
    sendSuccess(res, result, 'Materials');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const material = await materialService.getById(req.params.id);
    sendSuccess(res, { material }, 'Material');
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    await materialService.deleteMaterial(req.params.id, req.user!.id, req.user!.role === 'ADMIN');
    sendSuccess(res, { deleted: true }, 'Material deleted');
  }),

  /** Admin/dev helper to inspect extraction status. */
  chunks: asyncHandler(async (req: Request, res: Response) => {
    const { MaterialChunk } = await import('../models/MaterialChunk');
    const material = await materialService.getById(req.params.id);
    const chunks = await MaterialChunk.find({ materialId: material._id }).sort({ index: 1 }).select('index text embedding');
    sendSuccess(res, {
      chunks: chunks.map((c) => ({ index: c.index, text: c.text, hasEmbedding: Boolean(c.embedding?.length) })),
    }, 'Material chunks');
  }),
};

/** Removes an orphan temp file if validation failed after multer wrote it. */
export const cleanupUploadOnError = (req: Request, _res: Response, next: (err?: unknown) => void): void => {
  if (req.file?.path && fs.existsSync(req.file.path)) {
    fs.unlink(req.file.path, () => undefined);
  }
  next();
};
