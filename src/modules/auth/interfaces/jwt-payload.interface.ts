export interface JwtPayload {
  sub: string;      // User ID (standard JWT "subject" claim)
  email: string;
  iat?: number;     // Issued at (auto-added by jsonwebtoken)
  exp?: number;     // Expiry (auto-added by jsonwebtoken)
}

export interface RefreshTokenPayload extends JwtPayload {
  tokenId: string;  // DB ID of the RefreshToken record — lets us revoke it
}
