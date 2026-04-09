import type { PlaceholderJsonResponse } from '../../types/common';

/**
 * Notification domain: Nodemailer, web-push — in-app, email, browser push notifications.
 */
export class NotificationService {
  /**
   * Lists notifications for the current user (pagination, unread filter).
   */
  async listNotifications(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Notifications — Phase 8' };
  }

  /**
   * Persists and optionally fans out an in-app notification.
   */
  async createInAppNotification(_userId: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Create in-app notification — placeholder' };
  }

  /**
   * Marks one or all notifications as read.
   */
  async markAsRead(_ids: string[]): Promise<PlaceholderJsonResponse> {
    return { success: true, message: `Mark read (${_ids.length}) — placeholder` };
  }

  /**
   * Sends transactional email via Nodemailer (templates + queue optional).
   */
  async sendEmail(_to: string, _templateKey: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Send email — placeholder' };
  }

  /**
   * Dispatches web push to subscribed browsers (VAPID keys, payload).
   */
  async sendWebPush(_userId: string, _payload: Record<string, string>): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Web push — placeholder' };
  }

  /**
   * Registers or updates push subscription document for a user device.
   */
  async savePushSubscription(_userId: string, _subscription: unknown): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Save push subscription — placeholder' };
  }
}

export const notificationService = new NotificationService();
