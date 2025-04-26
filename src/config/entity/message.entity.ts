import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { ChatRoom } from './chat-room.entity';
import { MessageAttachment } from './message-attachement.entity';
import { MessageReaction } from './message-reaction.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ChatRoom, (chatRoom) => chatRoom.messages)
  chatRoom: ChatRoom;

  @ManyToOne(() => User, (user) => user.messages)
  user: User;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: false })
  is_encrypted: boolean;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => MessageReaction, (reaction) => reaction.message)
  reactions: MessageReaction[];

  @OneToMany(() => MessageAttachment, (attachment) => attachment.message)
  attachments: MessageAttachment[];

  @Column('jsonb', { nullable: true })
  readBy: { userId: string; readAt: Date }[];
}
