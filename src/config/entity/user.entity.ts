import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Message } from './message.entity';
import { UserRole } from '../../common/enum';
import { ChatRoom } from './chat-room.entity';
import { Notification } from './notification.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @ManyToOne(() => Organization, (org) => org.users)
  organization: Organization;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => ChatRoom, (chatRoom) => chatRoom.createdBy)
  createdRooms: ChatRoom[];

  @OneToMany(() => Message, (message) => message.user)
  messages: Message[];

  @Column({ type: 'boolean', default: false })
  isOnline: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastSeen: Date;

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];
}
