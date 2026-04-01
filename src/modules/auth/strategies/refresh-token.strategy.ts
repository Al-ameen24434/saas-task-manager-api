import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { RefreshTokenPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh', // Named differently from the access token strategy
) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
  ignoreExpiration: false,
  secretOrKey: configService.getOrThrow<string>('jwt.refreshSecret'),
  passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshTokenPayload) {
    // Attach the raw token so AuthService can look it up in the DB
    const refreshToken = req.body?.refreshToken as string;
    return { ...payload, refreshToken };
  }
}