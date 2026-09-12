import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.middleware';
import { searchController } from '../controllers/search.controller';

const router = Router();

router.use(optionalAuth);
router.get('/', searchController.globalSearch);

export default router;
