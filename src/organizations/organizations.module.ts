import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization, User } from 'src/config/entity';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, User])],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
