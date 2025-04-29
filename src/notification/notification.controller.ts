import {
  Controller,
  Query,
  Param,
  Patch,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from 'src/common/guards';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponse } from '@nestjs/swagger';
import { successMessages } from 'src/messages';
@ApiTags('Notification')
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get notifications' })
  @ApiResponse({
    status: 201,
    description: successMessages.notificationsFetched,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. User is not authenticated.',
  })
  @Get()
  @UseGuards(JwtAuthGuard)
  async getNotifications(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.notificationService.getNotifications(
      req.user.userId,
      page,
      limit,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 201,
    description: successMessages.notificationMarkedAsRead,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. User is not authenticated.',
  })
  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  async markAsRead(@Request() req, @Param('id') notificationId: string) {
    return this.notificationService.markAsRead(req.user.userId, notificationId);
  }
}
