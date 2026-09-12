import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { materialController } from '../controllers/material.controller';
import { upload } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticate);
router.post('/upload', upload.single('file'), materialController.upload);
router.get('/', materialController.list);
router.get('/:id', materialController.getById);
router.get('/:id/chunks', materialController.chunks);
router.delete('/:id', materialController.delete);

export default router;
