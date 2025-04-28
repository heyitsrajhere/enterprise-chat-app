import { IsString, IsArray, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatRoomDto {
  @ApiProperty({
    description: 'The name of the chat room',
    type: String,
    example: 'first',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Indicates if the chat room is private. Optional.',
    type: Boolean,
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiProperty({
    description: 'List of user IDs to be added to the chat room',
    type: [String],
    example: [
      '219cd9e2-97b3-40a2-87d7-13748b584a29',
      '51cbd15a-0227-402a-9bfa-e831b1557726',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
