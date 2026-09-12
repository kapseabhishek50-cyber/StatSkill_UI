import { Request, Response } from 'express';
import { asyncHandler, sendSuccess } from '../utils/apiResponse';
import { notificationService } from '../services/notification/notification.service';
import { parsePagination, buildPagination } from '../utils/pagination';

export const notificationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const p = parsePagination(req.query, 20);
    const unreadOnly = String(req.query.unread ?? 'false') === 'true';
    const { items, total } = await notificationService.list(req.user!.id, { page: p.page, limit: p.limit, unreadOnly });
    const unreadCount = await notificationService.unreadCount(req.user!.id);
    sendSuccess(res, { notifications: items, unreadCount, pagination: buildPagination(total, p) }, 'Notifications');
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    const notification = await notificationService.markRead(req.user!.id, req.params.id);
    sendSuccess(res, { notification }, 'Notification marked read');
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    const modified = await notificationService.markAllRead(req.user!.id);
    sendSuccess(res, { modified }, 'All notifications marked read');
  }),
};
