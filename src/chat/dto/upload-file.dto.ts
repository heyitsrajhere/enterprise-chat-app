import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UploadFileParamDto {
  @ApiProperty({
    example: '"4fa8968f-0414-49a3-b521-4786e3e66b49"',
    description: 'Message idof the message you are attaching file',
  })
  @IsUUID()
  messageId: string;
}
