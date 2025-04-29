import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { NotificationType } from '../../common/enum/notification.enum';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.notifications)
  user: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.NEW_MESSAGE,
  })
  type: NotificationType;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    roomId?: string;
    messageId?: string;
    senderId?: string;
    [key: string]: any;
  };

  @CreateDateColumn()
  created_at: Date;
}
