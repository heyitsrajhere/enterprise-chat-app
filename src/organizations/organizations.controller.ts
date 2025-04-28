import { Controller, Delete, Param, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { successMessages } from 'src/messages';
import { JwtAuthGuard } from 'src/common/guards';
import { UserRole } from 'src/common/enum';
import { Roles } from 'src/common/decorators';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a user from an organization' })
  @ApiParam({ name: 'org_id', description: 'The ID of the organization' })
  @ApiParam({ name: 'user_id', description: 'The ID of the user to remove' })
  @ApiResponse({
    status: 201,
    description: successMessages.userRemovedFromOrganization,
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
    description: 'Not Found. Organization or User not found.',
  })
  @Delete(':org_id/user/:user_id')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.ADMIN)
  async removeUserFromOrganization(
    @Param('org_id') orgId: string,
    @Param('user_id') userId: string,
  ) {
    return await this.organizationsService.removeUserFromOrganization(
      orgId,
      userId,
    );
  }
}
