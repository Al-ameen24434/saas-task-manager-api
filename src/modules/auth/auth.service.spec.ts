import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '@modules/users/users.service';
import { PrismaService } from '@database/prisma.service';
import { ResourceAlreadyExistsException } from '@common/exception/custom.exceptions';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { expect, jest } from '@jest/globals';
import { describe, beforeEach, it,afterEach  } from '@jest/globals';

// ✅ Properly typed bcrypt mock
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'alice@example.com',
    password: 'hashed_password',
    firstName: 'Alice',
    lastName: 'Johnson',
    avatarUrl: null,
    isActive: true,
    isEmailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findByIdOrThrow: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              create: jest.fn(),
            },
            refreshToken: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              const config: Record<string, unknown> = {
                'jwt.secret': 'test-secret',
                'jwt.expiresIn': '15m',
                'jwt.refreshSecret': 'test-refresh-secret',
                'jwt.refreshExpiresIn': '7d',
                BCRYPT_ROUNDS: 10,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);

    // ✅ Default mock behaviors
    (bcrypt.hash as unknown as jest.MockedFunction<(s: string, salt: number | string) => Promise<string>>).mockResolvedValue('hashed_password');
    (jwtService.signAsync as unknown as jest.MockedFunction<(payload: Record<string, unknown>, options?: object) => Promise<string>>).mockResolvedValue('mock-token');
  });

  afterEach(() => { jest.clearAllMocks(); });

  // ─── REGISTER ─────────────────────────────────────────

  describe('register()', () => {
    const registerDto = {
      email: 'alice@example.com',
      password: 'Password123!',
      firstName: 'Alice',
      lastName: 'Johnson',
    };

    it('should successfully register a new user', async () => {
      jest.mocked(usersService.findByEmail).mockResolvedValue(null);
      jest.mocked(prismaService.user.create).mockResolvedValue(mockUser as any);
      jest.mocked(prismaService.$transaction).mockResolvedValue([] as any);

      const result = await authService.register(registerDto);

      expect(usersService.findByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10);
      expect(prismaService.user.create).toHaveBeenCalled();

      expect(result.user.email).toBe('alice@example.com');
      expect(result.tokens).toBeDefined();
      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw conflict if email already exists', async () => {
      jest.mocked(usersService.findByEmail).mockResolvedValue(mockUser as any);

      await expect(authService.register(registerDto)).rejects.toThrow(
        ResourceAlreadyExistsException,
      );
    });
  });

  // ─── LOGIN ────────────────────────────────────────────

  describe('login()', () => {
    const loginDto = {
      email: 'alice@example.com',
      password: 'Password123!',
    };

    it('should successfully login with valid credentials', async () => {
      jest.mocked(usersService.findByEmail).mockResolvedValue(mockUser as any);
      (bcrypt.compare as unknown as jest.MockedFunction<(s: string, hash: string) => Promise<boolean>>).mockResolvedValue(true);
      jest.mocked(prismaService.$transaction).mockResolvedValue([] as any);

      const result = await authService.login(loginDto);

      expect(result.user.email).toBe('alice@example.com');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      jest.mocked(usersService.findByEmail).mockResolvedValue(mockUser as any);
      (bcrypt.compare as unknown as jest.MockedFunction<(s: string, hash: string) => Promise<boolean>>).mockResolvedValue(false);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      jest.mocked(usersService.findByEmail).mockResolvedValue(null);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      jest.mocked(usersService.findByEmail).mockResolvedValue({ ...mockUser, isActive: false } as any);
      (bcrypt.compare as unknown as jest.MockedFunction<(s: string, hash: string) => Promise<boolean>>).mockResolvedValue(true);

      await expect(authService.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── REFRESH TOKENS ───────────────────────────────────

  describe('refreshTokens()', () => {
    it('should throw if refresh token is revoked', async () => {
      jest.mocked(prismaService.refreshToken.findUnique).mockResolvedValue({
        token: 'old-token',
        userId: 'user-uuid-1',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 100000),
        user: mockUser,
      } as any);

      await expect(
        authService.refreshTokens('user-uuid-1', 'old-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if refresh token is expired', async () => {
      jest.mocked(prismaService.refreshToken.findUnique).mockResolvedValue({
        token: 'old-token',
        userId: 'user-uuid-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000),
        user: mockUser,
      } as any);

      await expect(
        authService.refreshTokens('user-uuid-1', 'old-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});

// ✅ Placeholder test
describe('AuthService Placeholder', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});