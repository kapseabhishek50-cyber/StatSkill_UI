import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { competencyController } from '../controllers/competency.controller';

const router = Router();

router.use(authenticate);
router.get('/', competencyController.listTaxonomy);
router.get('/roles', competencyController.listRoles);
router.get('/me', competencyController.myCompetencies);

export default router;
