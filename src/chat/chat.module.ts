import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ConfigModule } from '@nestjs/config';
import { ChatService } from './chat.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChatRoom,
  Message,
  MessageAttachment,
  MessageReaction,
  User,
  ChatRoomUser,
  Notification,
} from 'src/config/entity';
import { ChatController } from './chat.controller';
import { NotificationService } from 'src/notification/notification.service';
@Module({
  controllers: [ChatController],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      User,
      Message,
      ChatRoom,
      MessageAttachment,
      MessageReaction,
      ChatRoomUser,
      Notification,
    ]),
  ],
  providers: [ChatGateway, ChatService, NotificationService],
  exports: [ChatService],
})
export class ChatModule {}
