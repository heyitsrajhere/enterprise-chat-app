import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { decrypt, encrypt } from 'src/common/utils';
import {
  ChatRoom,
  Message,
  MessageAttachment,
  MessageReaction,
  User,
  ChatRoomUser,
} from 'src/config/entity';
import { errorMessages, successMessages } from 'src/messages';
import { In, Repository } from 'typeorm';
import { CreateChatRoomDto } from './dto';
import { ResponseInterface } from 'src/common/Interface/response.interface';
import { NotificationType, UserRole } from 'src/common/enum';
import { NotificationService } from 'src/notification/notification.service';
@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(ChatRoom)
    private readonly chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(MessageAttachment)
    private readonly messageAttachementRepository: Repository<MessageAttachment>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(MessageReaction)
    private readonly reactionRepository: Repository<MessageReaction>,
    @InjectRepository(ChatRoomUser)
    private readonly chatRoomUserRepository: Repository<ChatRoomUser>,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Saves a chat message to the database.
   * @param userId
   * @param roomId
   * @param content
   * @returns the saved message or an appropriate result.
   */
  async saveMessage(userId: string, roomId: string, content: string) {
    const [user, chatRoom] = await Promise.all([
      this.userRepository.findOneBy({ id: userId }),
      this.chatRoomRepository.findOneBy({ id: roomId }),
    ]);
    if (!user || !chatRoom) {
      throw new Error(errorMessages.invalidUserOrRoom);
    }

    if (user.organization.id !== chatRoom.organization.id) {
      throw new Error(errorMessages.accessDenied);
    }
    const encryptedContent = encrypt(content);

    const message = this.messageRepository.create({
      user,
      chatRoom,
      content: encryptedContent,
      is_encrypted: true,
      readBy: [{ userId, readAt: new Date() }],
    });

    return await this.messageRepository.save(message);
  }

  /**
   * Saves a private chat message between two users, encrypts the content, and saves it to the database.
   * @param senderId
   * @param recipientId
   * @param content the private message.
   * @returns the saved private message.
   */
  async savePrivateMessage(
    senderId: string,
    recipientId: string,
    content: string,
  ) {
    const [sender, recipient] = await Promise.all([
      this.userRepository.findOneBy({ id: senderId }),
      this.userRepository.findOneBy({ id: recipientId }),
    ]);
    if (!sender || !recipient) {
      throw new Error(errorMessages.invalidUser);
    }
    const encryptedContent = encrypt(content);
    const message = this.messageRepository.create({
      user: sender,
      content: encryptedContent,
      is_encrypted: true,
    });

    await this.messageRepository.save(message);

    return message;
  }

  /**
   * Saves an attachment to a message in the database.
   * @param file - The file object that is being uploaded.
   * @param messageId - The ID of the message the attachment belongs to.
   * @returns the success status and file URL.
   */
  async saveAttachement(file: Express.Multer.File, messageId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error(errorMessages.messageNotFound);
    }

    const attachment = this.messageAttachementRepository.create({
      message,
      fileName: file.filename,
      fileType: file.mimetype,
      fileSize: file.size,
      fileUrl: `/uploads/${file.filename}`,
    });

    await this.messageAttachementRepository.save(attachment);
    return { success: true, fileUrl: attachment.fileUrl };
  }

  /**
   * Retrieves all messages for a given user, with decrypted content.
   * Limits the number of messages to 100.
   * @param userId
   * @returns messages
   */
  async getMessages(userId: string) {
    const [user] = await Promise.all([
      this.userRepository.findOne({
        where: { id: userId },
        relations: { organization: true },
      }),
    ]);

    if (!user) {
      throw new Error(errorMessages.invalidUserOrRoom);
    }

    const messages = await this.messageRepository.find({
      order: { created_at: 'desc' },
      take: 100,
      relations: { user: true, attachments: true, reactions: true },
    });

    const decryptMessages = messages.map((message) => ({
      ...message,
      content: decrypt(message.content),
    }));

    return decryptMessages;
  }

  /**
   * Retrieves the organization associated with a given user.
   * @param userId
   * @returns the user's organization.
   */
  async getOrganization(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { organization: true },
    });
    if (!user) {
      throw new Error(errorMessages.userNotFound);
    }
    return user.organization;
  }

  /**
   * Adds a reaction to a message by a user.
   * @param userId
   * @param messageId
   * @param reactionType - The type of reaction (e.g., "like", "love").
   * @returns it saved reaction.
   */
  async addReaction(userId: string, messageId: string, reactionType: string) {
    const [user, message] = await Promise.all([
      this.userRepository.findOneBy({ id: userId }),
      this.messageRepository.findOne({
        where: { id: messageId },
        relations: { chatRoom: { organization: true } },
      }),
    ]);
    if (!user || !message) {
      throw new Error(errorMessages.invalidUserOrMessage);
    }

    let reaction = await this.reactionRepository.findOne({
      where: {
        user: { id: userId },
        message: { id: messageId },
        reaction: reactionType,
      },
    });
    if (!reaction) {
      reaction = this.reactionRepository.create({
        user,
        message,
        reaction: reactionType,
      });
      await this.reactionRepository.save(reaction);
    }
    return reaction;
  }

  /**
   * Removes a reaction from a message by a user.
   * @param userId
   * @param messageId
   * @param reactionType
   * @returns the deletion of the reaction.
   */
  async removeReaction(
    userId: string,
    messageId: string,
    reactionType: string,
  ) {
    return await this.reactionRepository.delete({
      user: { id: userId },
      message: { id: messageId },
      reaction: reactionType,
    });
  }

  /**
   * Retrieves all reactions for a given message.
   * @param messageId
   * @returns an array of reactions.
   */
  async getReactionForMessage(messageId: string) {
    return await this.reactionRepository.find({
      where: { message: { id: messageId } },
      relations: { user: true },
    });
  }

  /**
   * Marks a message as read by a recipient.
   * @param recipientId
   * @param messageId
   * @returns the update of the message's read status.
   */
  async markMessageAsRead(recipentId: string, messageId: string) {
    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });
    if (!message) {
      throw new Error(errorMessages.messageNotFound);
    }
    if (!message.readBy) {
      message.readBy = [];
    }
    const alreadyRead = message.readBy?.some(
      (entry) => entry.userId === recipentId,
    );
    if (alreadyRead) {
      return;
    }
    message.readBy.push({ userId: recipentId, readAt: new Date() });
    await this.messageRepository.save(message);
  }

  /**
   * Updates the online status and last seen timestamp for a given user.
   * @param userId
   * @param isOnline
   * @returns user status and last seen.
   */
  async updateUserStatus(userId: string, isOnline: boolean) {
    return await this.userRepository.update(
      { id: userId },
      { isOnline: isOnline, lastSeen: new Date() },
    );
  }

  /**
   * This will create chat room or group
   * @param dto
   * @param createdBy
   * @returns users with chatroom
   */
  async createChatRoom(
    dto: CreateChatRoomDto,
    createdByPayload: { userId: string },
  ): Promise<ResponseInterface> {
    try {
      const { name, userIds, isPrivate } = dto;
      const createdBy = await this.userRepository.findOne({
        where: { id: createdByPayload.userId },
        relations: ['organization'],
      });
      if (!createdBy) {
        throw new Error(errorMessages.userNotFound);
      }

      const users = await this.userRepository.find({
        where: { id: In(userIds) },
        relations: ['organization'],
      });

      if (users.length !== userIds.length) {
        throw new Error(errorMessages.userNotFound);
      }

      const chatRoom = this.chatRoomRepository.create({
        name,
        createdBy,
        isPrivate,
        organization: createdBy.organization,
      });

      const savedChatRoom = await this.chatRoomRepository.save(chatRoom);
      for (const userId of dto.userIds) {
        if (userId !== createdBy.id) {
          await this.notificationService.createNotification(
            userId,
            NotificationType.NEW_ROOM,
            'Added to New Room',
            { roomId: savedChatRoom.id },
          );
        }
      }
      const chatRoomUsers = users.map((user) => {
        const chatRoomUser = this.chatRoomUserRepository.create({
          user: { id: user.id },
          chatRoom: { id: savedChatRoom.id },
          role: user.id === createdBy.id ? UserRole.MODERATOR : UserRole.USER,
        });
        return chatRoomUser;
      });

      await this.chatRoomUserRepository.save(chatRoomUsers);

      const completeChatRoom = await this.chatRoomRepository.findOne({
        where: { id: savedChatRoom.id },
        relations: ['chatRoomUsers', 'chatRoomUsers.user'],
      });

      return {
        data: completeChatRoom,
        message: successMessages.chatRoomCreated,
        statusCode: 201,
      };
    } catch (error) {
      console.error('Detailed error while creating room:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw new BadRequestException(error.message);
    }
  }
  /**
   * It will delete chat room from db by admin
   * @param room_id
   * @returns message and success code
   */
  async deleteChatRoom(room_id: string): Promise<ResponseInterface> {
    try {
      const room = await this.chatRoomRepository.findOne({
        where: { id: room_id },
      });
      if (!room) {
        throw new NotFoundException(errorMessages.chatRoomNotFound);
      }

      // First delete all ChatRoomUser entries for this room
      await this.chatRoomUserRepository.delete({
        chatRoom: { id: room_id },
      });

      // Then delete the chat room
      await this.chatRoomRepository.delete(room_id);
      return { message: successMessages.chatRoomDeleted, statusCode: 201 };
    } catch (error) {
      console.error('error while deleting room', error.message);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Assigns moderator role to a user in a chat room
   * @param userId The ID of the user to assign as moderator
   * @param roomId The ID of the chat room
   * @returns Success message and status code
   */
  async assignModerator(
    userId: string,
    roomId: string,
  ): Promise<ResponseInterface> {
    try {
      const [user, chatRoom] = await Promise.all([
        this.userRepository.findOne({
          where: { id: userId },
          relations: { organization: true },
        }),
        this.chatRoomRepository.findOne({
          where: { id: roomId },
          relations: {
            chatRoomUsers: { user: true },
            organization: true,
          },
        }),
      ]);

      if (!user || !chatRoom) {
        throw new NotFoundException(errorMessages.invalidUserOrRoom);
      }

      const isUserInRoom = chatRoom.chatRoomUsers.some(
        (u) => u.user.id === userId,
      );

      if (!isUserInRoom) {
        throw new BadRequestException(errorMessages.userNotInRoom);
      }

      let chatRoomUser = await this.chatRoomUserRepository.findOne({
        where: {
          user: { id: userId },
          chatRoom: { id: roomId },
        },
      });

      if (!chatRoomUser) {
        chatRoomUser = this.chatRoomUserRepository.create({
          user: { id: userId },
          chatRoom: { id: roomId },
          role: UserRole.USER,
        });
      }

      if (chatRoomUser.role === UserRole.MODERATOR) {
        throw new BadRequestException(errorMessages.userAlreadyModerator);
      }

      chatRoomUser.role = UserRole.MODERATOR;
      await this.chatRoomUserRepository.save(chatRoomUser);
      await this.notificationService.createNotification(
        userId,
        NotificationType.ROLE_CHANGED,
        'Role Updated',
        { roomId: chatRoom.id },
      );
      return {
        message: successMessages.moderatorAssigned,
        statusCode: 200,
      };
    } catch (error) {
      console.error('Error while assigning moderator:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Joins a chat room.
   * @param userId
   * @param roomId
   * @returns the updated chat room.
   */
  async joinRoom(userId: string, roomId: string) {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      relations: ['chatRoomUsers', 'chatRoomUsers.user'],
    });
    if (!chatRoom) {
      throw new Error('Chat room does not exist.');
    }

    const alreadyInRoom = chatRoom.chatRoomUsers.some(
      (cru) => cru.user.id === userId,
    );
    if (alreadyInRoom) {
      throw new Error('User is already in the room.');
    }

    const chatRoomUser = this.chatRoomUserRepository.create({
      user: { id: userId },
      chatRoom: { id: roomId },
      role: UserRole.USER,
    });
    await this.chatRoomUserRepository.save(chatRoomUser);

    return {
      message: 'User added to room successfully.',
      roomId,
      userId,
    };
  }

  /**
   * Leaves a chat room.
   * @param userId
   * @param roomId
   * @returns the updated chat room.
   */
  async leaveRoom(userId: string, roomId: string) {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      relations: ['chatRoomUsers', 'chatRoomUsers.user'],
    });
    if (!chatRoom) {
      throw new NotFoundException(errorMessages.chatRoomNotFound);
    }

    const chatRoomUser = chatRoom.chatRoomUsers.find(
      (cru) => cru.user.id === userId,
    );
    if (!chatRoomUser) {
      throw new NotFoundException(errorMessages.userNotInRoom);
    }

    await this.chatRoomUserRepository.delete({
      user: { id: userId },
      chatRoom: { id: roomId },
    });

    return {
      message: successMessages.userLeftRoom,
      roomId,
      userId,
    };
  }

  /**
   * Saves a message to a group chat.
   * @param userId
   * @param roomId
   * @param content
   * @returns the saved message.
   */
  async saveMessageToGroup(userId: string, roomId: string, content: string) {
    const [user, chatRoom] = await Promise.all([
      this.userRepository.findOneBy({ id: userId }),
      this.chatRoomRepository.findOneBy({ id: roomId }),
    ]);
    if (!user || !chatRoom) {
      throw new Error(errorMessages.invalidUserOrRoom);
    }

    const isMember = await this.chatRoomUserRepository.findOne({
      where: { user: { id: userId }, chatRoom: { id: roomId } },
    });
    if (!isMember) {
      throw new Error(errorMessages.userNotInRoom);
    }
    const encryptContent = encrypt(content);
    const message = this.messageRepository.create({
      user,
      chatRoom,
      content: encryptContent,
      is_encrypted: true,
      readBy: [],
    });

    const savedMessage = await this.messageRepository.save(message);

    return savedMessage;
  }

  /**
   * Marks a message as read by a user in a group chat.
   * @param userId
   * @param messageId
   * @returns the updated message.
   */
  async markMessageAsReadInGroup(userId: string, messageId: string) {
    try {
      const message = await this.messageRepository.findOne({
        where: { id: messageId },
        relations: ['chatRoom'],
      });
      if (!message) {
        throw new Error(errorMessages.messageNotFound);
      }

      if (!message.readBy) {
        message.readBy = [];
      }
      const alreadyRead = message.readBy.some(
        (entry) => entry.userId === userId,
      );
      if (!alreadyRead) {
        message.readBy.push({ userId, readAt: new Date() });
        await this.messageRepository.save(message);
      }

      const decryptedMessage = {
        ...message,
        content: decrypt(message.content),
      };

      return decryptedMessage;
    } catch (error) {
      console.error('Error while marking message as read:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Deletes a message from a group chat.
   * @param moderatorId
   * @param messageId
   * @param roomId
   * @returns Success message and status code
   */
  async deleteGroupMessage(
    moderatorId: string,
    messageId: string,
    roomId: string,
  ) {
    try {
      const message = await this.messageRepository.findOne({
        where: { id: messageId, chatRoom: { id: roomId } },
        relations: [
          'chatRoom',
          'chatRoom.chatRoomUsers',
          'chatRoom.chatRoomUsers.user',
        ],
      });

      if (!message) {
        throw new Error(errorMessages.messageNotFound);
      }

      const moderatorInRoom = message.chatRoom.chatRoomUsers.find(
        (cru) =>
          cru.user.id === moderatorId &&
          (cru.role === UserRole.MODERATOR || cru.role === UserRole.ADMIN),
      );

      if (!moderatorInRoom) {
        throw new Error(errorMessages.notPermission);
      }

      await this.messageRepository.remove(message);

      return {
        success: true,
        messageId,
        roomId,
        deletedBy: moderatorId,
      };
    } catch (error) {
      console.error('Error while deleting message:', error.message);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Retrieves all users in a chat room.
   * @param roomId
   * @returns an array of users.
   */
  async getRoomUsers(roomId: string) {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: roomId },
      relations: ['chatRoomUsers', 'chatRoomUsers.user'],
    });

    if (!chatRoom) {
      throw new Error(errorMessages.chatRoomNotFound);
    }

    // Extract users from chatRoomUsers
    return chatRoom.chatRoomUsers.map((cru) => cru.user);
  }
}
