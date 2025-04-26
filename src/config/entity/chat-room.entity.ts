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

  @ManyToOne(() => User, { nullable: true })
  user1: User;

  @ManyToOne(() => User, { nullable: true })
  user2: User;
}
