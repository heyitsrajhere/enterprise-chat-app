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
} from 'src/config/entity';
import { CharController } from './chat.controller';

@Module({
  controllers: [CharController],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      User,
      Message,
      ChatRoom,
      MessageAttachment,
      MessageReaction,
    ]),
  ],
  providers: [ChatGateway, ChatService],
})
export class ChatModule {}
