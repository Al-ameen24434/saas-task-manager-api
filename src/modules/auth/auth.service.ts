import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@database/prisma.service';
import { UsersService } from '@modules/users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, TokensDto } from './dto/auth-response.dto';
import { UserResponseDto } from '@modules/users/dto/user-response.dto';
import {
  JwtPayload,
  RefreshTokenPayload,
} from './interfaces/jwt-payload.interface';
import { ResourceAlreadyExistsException } from '@common/exception/custom.exceptions';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User } from '@prisma/client';
import { SignOptions } from 'jsonwebtoken';
import { JwtSignOptions } from '@nestjs/jwt';


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─── REGISTER ──────────────────────────────────────────────────────────────
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ResourceAlreadyExistsException('User', 'email');
    }

    const rounds = parseInt(
  this.configService.get<string>('BCRYPT_ROUNDS', '10'),
  10,
);

    const hashedPassword = await bcrypt.hash(dto.password, rounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        password: hashedPassword,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
      },
    });

    this.logger.log(`New user registered: ${user.email}`);

    const tokens = await this.generateAndStoreTokens(user);

    return {
      user: UserResponseDto.fromEntity(user),
      tokens,
    };
  }

  // ─── LOGIN ─────────────────────────────────────────────────────────────────
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    this.logger.log(`User logged in: ${user.email}`);

    const tokens = await this.generateAndStoreTokens(user);

    return {
      user: UserResponseDto.fromEntity(user),
      tokens,
    };
  }

  // ─── REFRESH TOKEN ─────────────────────────────────────────────────────────
  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<TokensDto> {
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (
      !tokenRecord ||
      tokenRecord.userId !== userId ||
      tokenRecord.isRevoked ||
      tokenRecord.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    return this.generateAndStoreTokens(tokenRecord.user);
  }

  // ─── LOGOUT ────────────────────────────────────────────────────────────────
  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        token: refreshToken,
        isRevoked: false,
      },
      data: { isRevoked: true },
    });

    this.logger.log(`User logged out: ${userId}`);
  }

  // ─── LOGOUT ALL ────────────────────────────────────────────────────────────
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    this.logger.log(`All sessions revoked for user: ${userId}`);
  }

  // ─── GET CURRENT USER ──────────────────────────────────────────────────────
  async getMe(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.findByIdOrThrow(userId);
    return UserResponseDto.fromEntity(user);
  }

  // ─── PRIVATE HELPERS ───────────────────────────────────────────────────────
  private async generateAndStoreTokens(user: User): Promise<TokensDto> {
    const tokenId = uuidv4();

    const jwtPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const refreshPayload: RefreshTokenPayload = {
      ...jwtPayload,
      tokenId,
    };

    // ✅ SAFE CONFIG (NO MORE !)
    const jwtSecret =
      this.configService.getOrThrow<string>('jwt.secret');
const jwtExpiresIn =
  this.configService.get<string>('jwt.expiresIn', '15m') as JwtSignOptions['expiresIn'];

    const refreshSecret =
      this.configService.getOrThrow<string>('jwt.refreshSecret');
   const refreshExpiresIn =
  this.configService.get<string>('jwt.refreshExpiresIn', '7d') as JwtSignOptions['expiresIn'];

    // ✅ PARALLEL TOKEN GENERATION
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: jwtSecret,
        expiresIn: jwtExpiresIn,
        algorithm: 'HS256',
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
        algorithm: 'HS256',
      }),
    ]);

   const refreshExpiresAt = this.parseExpiresIn(refreshExpiresIn ?? '7d');

    await this.prisma.$transaction([
      this.prisma.refreshToken.create({
        data: {
          id: tokenId,
          token: refreshToken,
          userId: user.id,
          expiresAt: refreshExpiresAt,
        },
      }),
      this.prisma.refreshToken.deleteMany({
        where: {
          userId: user.id,
          OR: [
            { isRevoked: true },
            { expiresAt: { lt: new Date() } },
          ],
        },
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.parseDurationToSeconds(jwtExpiresIn ?? '15m'),
    };
  }

  private parseExpiresIn(expiresIn: string | number): Date {
  const now = new Date();

  // ✅ If it's a number → it's seconds
  if (typeof expiresIn === 'number') {
    return new Date(now.getTime() + expiresIn * 1000);
  }

  // ✅ If it's a string like '15m'
  const match = expiresIn.match(/^(\d+)([smhd])$/);

  if (!match) {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const map: Record<string, number> = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  };

  return new Date(now.getTime() + value * map[unit]);
}

  private parseDurationToSeconds(duration: string | number): number {
  if (typeof duration === 'number') return duration;

  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 900;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const map: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * map[unit];
}
}