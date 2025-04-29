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
import { ActionType, AuthenticatedSocket, UserRole } from 'src/common/enum';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationType } from 'src/common/enum';
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
    private notificationService: NotificationService,
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
      ) as AuthenticatedSocket['data']['user'];
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
      if (senderOrg.id !== recipientOrg.id) {
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

  @SubscribeMessage('create_room')
  async handleCreateRoom(
    @MessageBody() data: CreateChatRoomDto,
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    try {
      const user = socket.data.user;
      if (user.role !== UserRole.ADMIN) {
        socket.emit('error_event', {
          type: 'ACCESS_DENIED',
          message: errorMessages.notPermission,
        });
        return;
      }
      const result = await this.chatService.createChatRoom(data, {
        userId: user.userId,
      });
      this.server.emit('room_created', result.data);
      socket.emit('room_created_success', result);
    } catch (error) {
      socket.emit('error_event', {
        type: 'CREATE_ROOM_ERROR',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('delete_room')
  async handleDeleteRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    try {
      const user = socket.data.user;
      if (user.role !== UserRole.ADMIN) {
        socket.emit('error_event', {
          type: 'ACCESS_DENIED',
          message: errorMessages.notPermission,
        });
        return;
      }
      const result = await this.chatService.deleteChatRoom(data.roomId);
      this.server.emit('room_deleted', { roomId: data.roomId });
      socket.emit('room_deleted_success', result);
    } catch (error) {
      socket.emit('error_event', {
        type: 'DELETE_ROOM_ERROR',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    try {
      const user = socket.data.user;
      const result = await this.chatService.joinRoom(user.userId, data.roomId);
      socket.emit('join_room_success', result);
      this.server.to(data.roomId).emit('user_joined', { userId: user.userId });
    } catch (error) {
      socket.emit('error_event', {
        type: 'JOIN_ROOM_ERROR',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    try {
      const user = socket.data.user;
      const result = await this.chatService.leaveRoom(user.userId, data.roomId);
      socket.emit('leave_room_success', result);
      this.server.to(data.roomId).emit('user_left', { userId: user.userId });
    } catch (error) {
      socket.emit('error_event', {
        type: 'LEAVE_ROOM_ERROR',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    const user = socket.data.user;
    socket.to(data.roomId).emit('user_typing', {
      userId: user.userId,
      roomId: data.roomId,
    });
  }

  @SubscribeMessage('stop_typing')
  async handleStopTyping(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    const user = socket.data.user;
    socket.to(data.roomId).emit('user_stop_typing', {
      userId: user.userId,
      roomId: data.roomId,
    });
  }

  private isUserInRoom(userId: string, roomId: string): boolean {
    const socket = this.userSocketMap.get(userId);
    if (!socket) return false;

    const socketInstance = this.server.sockets.sockets.get(socket);
    if (!socketInstance) return false;

    return socketInstance.rooms.has(roomId);
  }

  @SubscribeMessage('send_room_message')
  async handleSendRoomMessage(
    @MessageBody() data: { roomId: string; message: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    try {
      const user = socket.data.user;
      const savedMessage = await this.chatService.saveMessageToGroup(
        user.userId,
        data.roomId,
        data.message,
      );

      const decryptMessages = decrypt(savedMessage.content);
      this.server.to(data.roomId).emit('new_room_message', {
        message: decryptMessages,
        senderId: user.userId,
        messageId: savedMessage.id,
        roomId: data.roomId,
        createdAt: savedMessage.created_at,
      });
      const roomUsers = await this.chatService.getRoomUsers(data.roomId);
      const otherUsers = roomUsers.filter(
        (user) => user.id !== socket.data.user.userId,
      );

      // Create notifications for users not in the active room
      for (const user of otherUsers) {
        if (!this.isUserInRoom(user.id, data.roomId)) {
          await this.notificationService.createNotification(
            user.id,
            NotificationType.NEW_MESSAGE,
            'New Message',
            {
              roomId: data.roomId,
              messageId: savedMessage.id,
              senderId: socket.data.user.userId,
            },
          );
        }
      }
      socket.emit('room_message_sent', {
        messageId: savedMessage.id,
        roomId: data.roomId,
      });
    } catch (error) {
      socket.emit('error_event', {
        type: 'SEND_ROOM_MESSAGE_ERROR',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('read_group_message')
  async handleReadGroupMessage(
    @MessageBody() data: { messageId: string; roomId: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    try {
      const user = socket.data.user;
      const result = await this.chatService.markMessageAsReadInGroup(
        user.userId,
        data.messageId,
      );
      socket.to(data.roomId).emit('user_read_message', {
        messageId: data.messageId,
        userId: user.userId,
        roomId: data.roomId,
      });
      socket.emit('read_message_success', result);
    } catch (error) {
      socket.emit('error_event', {
        type: 'READ_MESSAGE_ERROR',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('delete_group_message')
  async handleDeleteGroupMessage(
    @MessageBody() data: { messageId: string; roomId: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    try {
      const user = socket.data.user;

      const result = await this.chatService.deleteGroupMessage(
        user.userId,
        data.messageId,
        data.roomId,
      );

      this.server.to(data.roomId).emit('message_deleted', {
        messageId: data.messageId,
        roomId: data.roomId,
        deletedBy: user.userId,
      });

      socket.emit('delete_message_success', result);
    } catch (error) {
      socket.emit('error_event', {
        type: 'DELETE_MESSAGE_ERROR',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('mark_notification_read')
  async handleMarkNotificationRead(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() socket: AuthenticatedSocket,
  ) {
    try {
      await this.notificationService.markAsRead(
        socket.data.user.userId,
        data.notificationId,
      );
    } catch (error) {
      socket.emit('error_event', {
        type: 'NOTIFICATION_ERROR',
        message: error.message,
      });
    }
  }
}
