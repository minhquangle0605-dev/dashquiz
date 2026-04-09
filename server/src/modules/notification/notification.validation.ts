/**
 * Planned Zod schemas (notification module):
 * - listNotificationsQuerySchema — page, limit, unreadOnly
 * - createNotificationBodySchema — userId, title, body, type, metadata
 * - markReadBodySchema — ids: string[] | 'all'
 * - sendEmailBodySchema — to, templateKey, variables
 * - webPushBodySchema — userId, title, body, url
 * - pushSubscriptionBodySchema — endpoint, keys (p256dh, auth)
 */

export const notificationSchemas = {} as const;
