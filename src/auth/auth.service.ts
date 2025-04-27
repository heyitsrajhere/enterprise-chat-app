import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegisterDto, LoginDto } from './dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Organization, User } from '../config/entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { errorMessages, successMessages } from '../messages';
import * as bcrypt from 'bcrypt';
import { ResponseInterface } from '../common/Interface/response.interface';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Register a new user
   * @param registerDto - The registration data
   * @returns The registered user and a JWT token
   */
  async register(registerDto: RegisterDto): Promise<ResponseInterface> {
    try {
      const { email, username, password, organizationId } = registerDto;
      // Check if organization exists
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });
      if (!organization) {
        throw new NotFoundException(errorMessages.organizationNotFound);
      }
      const emailExists = await this.userRepository.findOne({
        where: { email },
      });
      if (emailExists) {
        throw new ConflictException(errorMessages.emailAlreadyExist);
      }

      // Check if username already exists
      const usernameExists = await this.userRepository.findOne({
        where: { username },
      });
      if (usernameExists) {
        throw new ConflictException(errorMessages.usernameAlreadyExist);
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = this.userRepository.create({
        ...registerDto,
        password: hashedPassword,
        organization: organization,
      });
      await this.userRepository.save(newUser);

      return {
        message: successMessages.userCreated,
        statusCode: 201,
      };
    } catch (error) {
      throw new ConflictException(error.message);
    }
  }

  /**
   * Login a user
   * @param loginDto - The login data
   * @returns The logged in user and a JWT token
   */
  async login(loginDto: LoginDto): Promise<ResponseInterface> {
    try {
      const user = await this.userRepository.findOne({
        where: { email: loginDto.email },
        relations: ['organization'],
      });

      if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
        throw new BadRequestException(errorMessages.loginFailed);
      }

      const payload = {
        sub: user.id,
        email: user.email,
        userId: user.id,
        role: user.role,
        orgId: user.organization.id,
      };

      const accessToken = this.jwtService.sign(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'),
      });
      const refreshToken = this.jwtService.sign(payload, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN'),
      });

      return {
        message: successMessages.loginSuccess,
        data: {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            organization_id: user.organization.id,
            organization_name: user.organization.name,
          },
        },
        statusCode: 200,
      };
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  /**
   * Refresh a token
   * @param token - The refresh token
   * @returns The refreshed token
   */
  async refreshToken(token: string): Promise<ResponseInterface> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
      });
      delete payload.exp;
      delete payload.iat;

      const accessToken = this.jwtService.sign(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'),
      });

      return {
        message: successMessages.tokenRefreshed,
        data: { accessToken },
        statusCode: 200,
      };
    } catch (err) {
      throw new HttpException(
        err.message ?? errorMessages.failedToRefreshToken,
        err.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
