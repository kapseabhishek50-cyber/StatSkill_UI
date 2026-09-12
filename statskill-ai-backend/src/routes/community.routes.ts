import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { communityController } from '../controllers/community.controller';
import { validate } from '../middleware/validation.middleware';
import { createCommunitySchema, sendMessageSchema, reportMessageSchema } from '../validators/community.validator';

const router = Router();

router.use(authenticate);
router.get('/', communityController.list);
router.post('/', validate({ body: createCommunitySchema }), communityController.create);
router.get('/:id', communityController.getById);
router.post('/:id/join', communityController.join);
router.post('/:id/leave', communityController.leave);
router.get('/:id/members', communityController.members);
router.get('/:id/messages', communityController.messages);
router.post('/:id/messages', validate({ body: sendMessageSchema }), communityController.send);
router.delete('/:id/messages/:messageId', communityController.deleteMessage);
router.post('/:id/messages/:messageId/report', validate({ body: reportMessageSchema }), communityController.reportMessage);

export default router;
