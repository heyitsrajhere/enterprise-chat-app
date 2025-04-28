import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Organization, User } from 'src/config/entity';
import { errorMessages, successMessages } from 'src/messages';
import { Repository } from 'typeorm';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * This will remove user from organization
   * @param orgId
   * @param userId
   * @returns message and status code
   */
  async removeUserFromOrganization(orgId: string, userId: string) {
    const organization = await this.organizationRepository.findOne({
      where: { id: orgId },
      relations: { users: true },
    });

    if (!organization) {
      throw new Error(errorMessages.organizationNotFound);
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new Error(errorMessages.userNotFound);
    }
    if (!organization.users.some((u) => u.id === userId)) {
      throw new Error(errorMessages.userNotInOrganization);
    }

    organization.users = organization.users.filter((u) => u.id !== userId);
    await this.organizationRepository.save(organization);

    return {
      message: successMessages.userRemovedFromOrganization,
      statusCode: 201,
    };
  }
}
