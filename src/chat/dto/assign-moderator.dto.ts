import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignModeratorDto {
  @ApiProperty({
    description: 'The ID of the user to assign as moderator',
    type: String,
    example: '219cd9e2-97b3-40a2-87d7-13748b584a29',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'The ID of the chat room',
    type: String,
    example: '51cbd15a-0227-402a-9bfa-e831b1557726',
  })
  @IsString()
  roomId: string;
}
