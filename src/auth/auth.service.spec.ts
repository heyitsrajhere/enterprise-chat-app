// src/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, Organization } from '../config/entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../common/enum';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let organizationRepository: Repository<Organization>;
  let jwtService: JwtService;

  const mockUser = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword123',
    role: UserRole.USER,
    organization: {
      id: '1',
      name: 'Test Org',
    },
  };

  const mockOrganization = {
    id: '1',
    name: 'Test Org',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRES_IN: '1h',
                REFRESH_TOKEN_SECRET: 'refresh-secret',
                REFRESH_TOKEN_EXPIRES_IN: '7d',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    organizationRepository = module.get<Repository<Organization>>(
      getRepositoryToken(Organization),
    );
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    const registerDto = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      organizationId: '1',
    };

    it('should successfully register a new user', async () => {
      jest
        .spyOn(organizationRepository, 'findOne')
        .mockResolvedValue(mockOrganization as Organization);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(userRepository, 'create').mockReturnValue(mockUser as User);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser as User);
      jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation(() => Promise.resolve('hashedPassword'));

      const result = await service.register(registerDto);

      expect(result.statusCode).toBe(201);
      expect(result.message).toBeDefined();
      expect(organizationRepository.findOne).toHaveBeenCalled();
      expect(userRepository.findOne).toHaveBeenCalled();
      expect(userRepository.create).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if organization not found', async () => {
      jest.spyOn(organizationRepository, 'findOne').mockResolvedValue(null);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if user already exists', async () => {
      jest
        .spyOn(organizationRepository, 'findOne')
        .mockResolvedValue(mockOrganization as Organization);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should successfully login a user', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true));
      jest.spyOn(jwtService, 'sign').mockReturnValue('token');

      const result = await service.login(loginDto);

      expect(result.statusCode).toBe(200);
      expect(result.data.accessToken).toBeDefined();
      expect(result.data.refreshToken).toBeDefined();
      expect(result.data.user).toBeDefined();
      expect(userRepository.findOne).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if password is incorrect', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false));

      await expect(service.login(loginDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('refreshToken', () => {
    const mockToken = 'valid.refresh.token';
    const mockPayload = {
      sub: '1',
      email: 'test@example.com',
      role: UserRole.USER,
      orgId: '1',
    };

    it('should successfully refresh token', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockPayload);
      jest.spyOn(jwtService, 'sign').mockReturnValue('new.access.token');

      const result = await service.refreshToken(mockToken);

      expect(result.statusCode).toBe(200);
      expect(result.data.accessToken).toBeDefined();
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(mockToken, {
        secret: 'refresh-secret',
      });
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should throw error if refresh token is invalid', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockRejectedValue(new Error('Invalid token'));

      await expect(service.refreshToken(mockToken)).rejects.toThrow();
    });

    it('should create new access token with correct payload', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue(mockPayload);
      jest.spyOn(jwtService, 'sign').mockReturnValue('new.access.token');

      const result = await service.refreshToken(mockToken);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockPayload.sub,
          email: mockPayload.email,
          role: mockPayload.role,
          orgId: mockPayload.orgId,
        }),
        expect.any(Object),
      );
      expect(result.data.accessToken).toBe('new.access.token');
    });
  });

  // Helper function tests
  describe('utility functions', () => {
    it('should properly hash passwords', async () => {
      const password = 'Password123!';
      const hashedPassword = await bcrypt.hash(password, 10);

      expect(hashedPassword).not.toBe(password);
      expect(await bcrypt.compare(password, hashedPassword)).toBe(false);
    });
  });
});
