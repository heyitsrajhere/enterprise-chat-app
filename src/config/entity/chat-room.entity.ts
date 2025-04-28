import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { User } from './user.entity';
import { Message } from './message.entity';
import { ChatRoomUser } from './chat-room-user.entity';

@Entity('chat_rooms')
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Organization, (org) => org.chatRooms)
  organization: Organization;

  @ManyToOne(() => User, (user) => user.createdRooms)
  createdBy: User;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Message, (message) => message.chatRoom)
  messages: Message[];

  @Column({ nullable: true })
  isPrivate: boolean;

  @OneToMany(() => ChatRoomUser, (chatRoomUser) => chatRoomUser.chatRoom)
  chatRoomUsers: ChatRoomUser[];
}
