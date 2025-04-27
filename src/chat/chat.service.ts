import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { decrypt, encrypt } from 'src/common/utils';
import {
  ChatRoom,
  Message,
  MessageAttachment,
  MessageReaction,
  User,
} from 'src/config/entity';
import { errorMessages } from 'src/messages';
import { Repository } from 'typeorm';

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
    console.log(message);
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
    console.log(recipentId, new Date());
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
}
