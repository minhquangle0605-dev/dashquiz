import { Router } from 'express';
import * as controller from './discussion.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import { ROLES } from '../../utils/constants';
import {
  listDiscussionsQuerySchema,
  createDiscussionSchema,
  updateDiscussionSchema,
  createReplySchema,
  updateReplySchema,
} from './discussion.validation';

const router = Router();

router.get(
  '/admin/all',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(listDiscussionsQuerySchema, 'query'),
  controller.adminListDiscussions,
);

router.get('/', authenticate, validate(listDiscussionsQuerySchema, 'query'), controller.listDiscussions);

router.post(
  '/',
  authenticate,
  validate(createDiscussionSchema),
  activityLogger('CREATE_DISCUSSION', 'discussion'),
  controller.createDiscussion,
);

router.get('/:id', authenticate, controller.getDiscussion);

router.put(
  '/:id',
  authenticate,
  validate(updateDiscussionSchema),
  activityLogger('UPDATE_DISCUSSION', 'discussion'),
  controller.updateDiscussion,
);

router.delete(
  '/:id',
  authenticate,
  activityLogger('DELETE_DISCUSSION', 'discussion'),
  controller.deleteDiscussion,
);

router.post(
  '/:id/replies',
  authenticate,
  validate(createReplySchema),
  activityLogger('CREATE_DISCUSSION_REPLY', 'discussion_reply'),
  controller.createReply,
);

router.put(
  '/replies/:replyId',
  authenticate,
  validate(updateReplySchema),
  activityLogger('UPDATE_DISCUSSION_REPLY', 'discussion_reply'),
  controller.updateReply,
);

router.delete(
  '/replies/:replyId',
  authenticate,
  activityLogger('DELETE_DISCUSSION_REPLY', 'discussion_reply'),
  controller.deleteReply,
);

export default router;
