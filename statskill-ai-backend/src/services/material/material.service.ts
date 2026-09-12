import { Material } from '../../models/Material';
import { MaterialChunk } from '../../models/MaterialChunk';
import { extractText, cleanText } from './textExtraction.service';
import { chunkText } from './chunking.service';
import { embeddingJob } from '../../jobs/embedding.job';
import { notFound, forbidden } from '../../utils/errors';
import { parsePagination, mongoSort, buildPagination } from '../../utils/pagination';
import { Request } from 'express';
import { audit } from '../../middleware/audit.middleware';
import { logger } from '../../utils/logger';

const log = logger;

export const materialService = {
  /** Registers an uploaded file then processes it asynchronously. */
  async registerUpload(input: {
    title: string;
    description?: string;
    tags?: string[];
    uploadedBy: string;
    filename: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    fileType: 'PDF' | 'DOCX' | 'PPTX' | 'TXT';
  }) {
    const material = await Material.create({ ...input, status: 'UPLOADED' });
    void audit(null, 'MATERIAL_UPLOADED', 'material', String(material._id), { by: input.uploadedBy, fileType: input.fileType });
    // Heavy work off the request thread.
    const { enqueueJob } = await import('../../jobs/queue');
    void enqueueJob('material.process', async () => {
      await this.processMaterial(String(material._id));
    }, 'material.process');
    return material;
  },

  /** Extract → clean → chunk → store → embed (prompt §23 pipeline). */
  async processMaterial(materialId: string): Promise<void> {
    const material = await Material.findById(materialId);
    if (!material) return;
    try {
      material.status = 'PROCESSING';
      await material.save();

      const raw = await extractText(material.storagePath, material.fileType);
      const clean = cleanText(raw);
      if (!clean || clean.length < 40) throw new Error('Extracted text is too short or empty');

      await MaterialChunk.deleteMany({ materialId });
      const chunks = chunkText(clean);
      await MaterialChunk.insertMany(chunks.map((c) => ({ materialId, index: c.index, text: c.text })));

      material.extractedChars = clean.length;
      material.chunkCount = chunks.length;
      material.status = 'READY';
      material.error = undefined;
      await material.save();

      await embeddingJob.runMaterialChunks(materialId);
      log.info({ materialId, chunks: chunks.length }, 'material processed');
    } catch (err) {
      material.status = 'FAILED';
      material.error = (err as Error).message.slice(0, 500);
      await material.save();
      log.warn({ materialId, err: material.error }, 'material processing failed');
    }
  },

  async listForTrainer(trainerId: string, req: Request) {
    const p = parsePagination(req.query);
    const filter: Record<string, unknown> = { uploadedBy: trainerId };
    const [items, total] = await Promise.all([
      Material.find(filter).sort(mongoSort(p)).skip(p.skip).limit(p.limit).select('-storagePath'),
      Material.countDocuments(filter),
    ]);
    return { items, pagination: buildPagination(total, p) };
  },

  async getById(id: string) {
    const material = await Material.findById(id).select('-storagePath');
    if (!material) throw notFound('Material not found');
    return material;
  },

  async deleteMaterial(id: string, userId: string, isAdmin = false) {
    const material = await Material.findById(id);
    if (!material) throw notFound('Material not found');
    if (!isAdmin && String(material.uploadedBy) !== userId) throw forbidden('Not your material');
    await MaterialChunk.deleteMany({ materialId: id });
    await material.deleteOne();
  },
};
