import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { ChatRoom } from './chat-room.entity';
import { UserRole } from '../../common/enum';

@Entity('chat_room_users')
@Unique(['user', 'chatRoom'])
export class ChatRoomUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.chatRoomUsers)
  user: User;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.chatRoomUsers)
  chatRoom: ChatRoom;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @CreateDateColumn()
  created_at: Date;
}
