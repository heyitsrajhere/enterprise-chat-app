import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationType } from 'src/common/enum';
import { Notification } from 'src/config/entity';
import { errorMessages } from 'src/messages';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Creates a new notification.
   * @param userId
   * @param type
   * @param content - The content of the notification.
   * @param metadata - Additional metadata for the notification.
   * @returns The created notification.
   * */
  async createNotification(
    userId: string,
    type: NotificationType,
    content: string,
    metadata?: any,
  ) {
    const notification = this.notificationRepository.create({
      user: { id: userId },
      type,
      content,
      metadata,
      isRead: false,
    });

    const saved = await this.notificationRepository.save(notification);

    return saved;
  }

  /**
   * Get notifications for a user.
   * @param userId
   * @param page
   * @param limit
   * @returns The notifications and metadata.
   */
  async getNotifications(userId: string, page = 1, limit = 10) {
    const [notifications, total] =
      await this.notificationRepository.findAndCount({
        where: { user: { id: userId } },
        order: { created_at: 'DESC' },
        take: limit,
        skip: (page - 1) * limit,
      });

    return {
      notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Marks a notification as read.
   * @param userId
   * @param notificationId
   * @returns The updated notification.
   * @throws NotFoundException if the notification is not found.
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, user: { id: userId } },
    });

    if (!notification) {
      throw new NotFoundException(errorMessages.notificationNotFound);
    }

    notification.isRead = true;
    return this.notificationRepository.save(notification);
  }
}
