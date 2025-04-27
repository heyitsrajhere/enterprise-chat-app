import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { errorMessages, successMessages } from 'src/messages';
import * as jwt from 'jsonwebtoken';
import { ChatService } from './chat.service';
import { decrypt } from 'src/common/utils';
import { ActionType, AuthenticatedSocket } from 'src/common/enum';
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSocketMap: Map<string, string> = new Map();
  private rateLimitMap: Map<string, number> = new Map();
  private rateLimitThreshold = 5000;
  private onlineUsers: Set<string> = new Set();

  constructor(
    private configService: ConfigService,
    private chatService: ChatService,
  ) {}

  async handleConnection(@ConnectedSocket() socket: AuthenticatedSocket) {
    try {
      const token = socket.handshake.headers.authorization as string;
      if (!token || !token.startsWith('Bearer ')) {
        console.log(errorMessages.tokenNotFound);
        socket.emit('error_event', {
          type: 'AUTH_ERROR',
          message: errorMessages.tokenNotFound,
        });
        socket.disconnect();
        return;
      }

      const jwtToken = token.split(' ')[1];
      const decoded = jwt.verify(
        jwtToken,
        this.configService.get<string>('JWT_SECRET'),
      ) as { userId: string; email: string };
      socket.data.user = decoded;
      if (!decoded?.userId) {
        console.log(errorMessages.invalidPayload);
        socket.emit('error_event', {
          type: 'AUTH_ERROR',
          message: errorMessages.invalidPayload,
        });
        socket.disconnect();
        return;
      }
      this.onlineUsers.add(decoded.userId);

      this.server.emit('user_online', {
        userId: decoded.userId,
      });

      await this.chatService.updateUserStatus(decoded.userId, true);
      this.userSocketMap.set(decoded.userId, socket.id);
      console.log(`User ${decoded.userId} connected with socket ${socket.id}`);

      socket.emit('connected', {
        message: successMessages.websocketConnected,
      });

      const previousMessages = await this.chatService.getMessages(
        decoded.userId,
      );
      console.log(previousMessages);
      socket.emit('previous_messages', previousMessages);
    } catch (error) {
      console.error('Connection error:', error.message);
      socket.emit('error_event', {
        type: 'AUTH_ERROR',
        message: error.message,
      });
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    console.log(`Socket ${socket.id} disconnected`);

    for (const [userId, socketId] of this.userSocketMap.entries()) {
      if (socketId === socket.id) {
        this.userSocketMap.delete(userId);
        this.onlineUsers.delete(userId);

        console.log(`User ${userId} disconnected`);
        await this.chatService.updateUserStatus(userId, false);
        break;
      }
    }
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @MessageBody() data: { recipientId: string; message: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    try {
      const sender = socket.data.user;
      const senderId = sender.userId;

      const recipientId = data.recipientId;
      const messageContent = data.message;
      const currentTime = Date.now();
      const lastMessageTime = this.rateLimitMap.get(senderId);
      if (
        lastMessageTime &&
        currentTime - lastMessageTime < this.rateLimitThreshold
      ) {
        socket.emit('error_event', {
          type: 'RATE_LIMIT_ERROR',
          message: errorMessages.limitExceed,
        });
        return;
      }

      this.rateLimitMap.set(senderId, currentTime);

      const senderOrg = await this.chatService.getOrganization(senderId);
      const recipientOrg = await this.chatService.getOrganization(recipientId);
      console.log(senderOrg, recipientOrg);
      if (senderOrg.id !== recipientOrg.id) {
        console.log('first');
        socket.emit('error_event', {
          type: 'ACCESS_DENIED',
          message: errorMessages.outsideOrganization,
        });

        return;
      }

      const savedMessage = await this.chatService.savePrivateMessage(
        senderId,
        recipientId,
        messageContent,
      );

      const recipientSocketId = this.userSocketMap.get(recipientId);
      const decryptedContent = decrypt(savedMessage.content);

      this.server.to(recipientSocketId).emit('new_private_message', {
        message: decryptedContent,
        senderId: senderId,
        messageId: savedMessage.id,
        createdAt: savedMessage.created_at,
      });

      socket.emit('message_sent', {
        messageId: savedMessage.id,
        recipientId: recipientId,
      });
    } catch (error) {
      console.error('Send Message Error:', error.message);
      socket.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('read_message')
  async handleReadMessage(
    @MessageBody() data: { messageId: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    try {
      const user = socket.data.user;
      const { messageId } = data;
      await this.chatService.markMessageAsRead(user.userId, messageId);

      socket.to(messageId).emit('user_read_message', {
        messageId,
        userId: user.userId,
      });
    } catch (error) {
      console.error('Read Message Error:', error.message);
      socket.emit('error_event', {
        type: 'SERVER_ERROR',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('update_reaction')
  async handleUpdateReaction(
    @MessageBody()
    data: {
      messageId: string;
      reaction: string;
      action: ActionType.ADD | ActionType.REMOVE;
    },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    try {
      const user = socket.data.user;

      const { messageId, reaction, action } = data;

      if (action === ActionType.ADD) {
        await this.chatService.addReaction(user.userId, messageId, reaction);
        socket.to(messageId).emit('reaction_added', {
          userId: user.userId,
          messageId,
          reaction,
        });
      } else if (action === ActionType.REMOVE) {
        await this.chatService.removeReaction(user.userId, messageId, reaction);
        socket.to(messageId).emit('reaction_removed', {
          userId: user.userId,
          messageId,
          reaction,
        });
      } else {
        socket.emit('error_event', {
          type: 'INVALID_ACTION',
          message: errorMessages.invalidAction,
        });
      }
    } catch (error) {
      console.error('Update Reaction Error:', error.message);
      socket.emit('error_event', {
        type: 'SERVER_ERROR',
        message: error.message,
      });
    }
  }
}
