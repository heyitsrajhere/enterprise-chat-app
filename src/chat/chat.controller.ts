import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Query,
  Body,
  Put,
  Req,
  Delete,
  Param,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard, RoleGuard } from 'src/common/guards';
import {
  UploadFileParamDto,
  AssignModeratorDto,
  CreateChatRoomDto,
} from './dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from 'src/common/enum';
import { Roles } from 'src/common/decorators';
import { successMessages } from 'src/messages';
import { User } from 'src/config/entity';
import { ApiTags } from '@nestjs/swagger';
@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiBearerAuth()
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload a file' })
  @ApiBody({
    description: 'File upload',
    type: 'object',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'Bad request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, uniqueSuffix + extname(file.originalname));
        },
      }),
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query() param: UploadFileParamDto,
  ) {
    return this.chatService.saveAttachement(file, param.messageId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new chat room' })
  @ApiBody({
    type: CreateChatRoomDto,
    description: 'Data required to create a new chat room',
  })
  @ApiResponse({
    status: 201,
    description: successMessages.chatRoomCreated,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have the required permissions.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. User is not authenticated.',
  })
  @Post('room')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  async createRoom(
    @Body() body: CreateChatRoomDto,
    @Req() req: Request & { user: User },
  ) {
    return await this.chatService.createChatRoom(body, {
      userId: req.user.id,
    });
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a chat room' })
  @ApiParam({
    name: 'room_id',
    description: 'The ID of the chat room to delete',
  })
  @ApiResponse({
    status: 201,
    description: successMessages.chatRoomDeleted,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have the required permissions.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. User is not authenticated.',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found. Chat room not found.',
  })
  @Delete(':room_id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  async deleteChatRoom(@Param('room_id') roomId: string) {
    return await this.chatService.deleteChatRoom(roomId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign moderator role to a user in a chat room' })
  @ApiBody({
    type: AssignModeratorDto,
    description: 'Data required to assign moderator role',
  })
  @ApiResponse({
    status: 200,
    description: 'Moderator role assigned successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have the required permissions.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. User is not authenticated.',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found. User or chat room not found.',
  })
  @Put('assign-moderator')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.ADMIN)
  async assignModerator(@Body() body: AssignModeratorDto) {
    return await this.chatService.assignModerator(body.userId, body.roomId);
  }
}
