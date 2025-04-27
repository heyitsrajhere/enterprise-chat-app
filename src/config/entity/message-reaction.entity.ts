import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Message } from './message.entity';
import { User } from './user.entity';

@Entity('message_reactions')
@Unique(['message', 'user', 'reaction'])
export class MessageReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Message, (message) => message.reactions, {
    onDelete: 'CASCADE',
  })
  message: Message;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  reaction: string;

  @CreateDateColumn()
  created_at: Date;
}
