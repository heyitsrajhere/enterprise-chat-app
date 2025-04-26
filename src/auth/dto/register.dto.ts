// src/auth/dto/register.dto.ts
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { errorMessages } from 'src/messages';

export class RegisterDto {
  @ApiProperty({
    example: 'johndoe',
    description: 'The username of the user',
  })
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address of the user',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Password@123',
    description:
      'Password (must contain uppercase, lowercase, number, and special character)',
  })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message: errorMessages.invalidPassword,
    },
  )
  password: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The UUID of the organization',
  })
  @IsNotEmpty()
  organizationId: string;
}
