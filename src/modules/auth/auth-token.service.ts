import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { UserService } from '@modules/user/user.service';

interface JwtPayload {
  email: string;
  id?: ID;
  sub?: ID;
  iat?: number;
  exp?: number;
}

interface AuthenticatedUser {
  id: ID;
  email: Email;
}

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {}

  async authenticateToken(token?: string): Promise<AuthenticatedUser> {
    if (!token) {
      throw new UnauthorizedException('Authorization is missing');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow('JWT_SECRET'),
      });
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      }
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.userService.findOne(payload.email);
    return { id: user.id, email: user.email };
  }

  extractHttpToken(request: {
    cookies?: Record<string, string>;
    headers?: Record<string, unknown>;
  }) {
    const cookieToken = request.cookies?.access_token;
    const headerToken = this.extractAuthorizationToken(
      request.headers?.authorization || request.headers?.Authorization,
    );

    return cookieToken || headerToken;
  }

  extractSocketToken(params: {
    authToken?: unknown;
    authorization?: unknown;
    cookieHeader?: string;
  }) {
    const authToken = this.normalizeToken(params.authToken);
    if (authToken) return authToken;

    const headerToken = this.extractAuthorizationToken(params.authorization);
    if (headerToken) return headerToken;

    return this.extractCookieToken(params.cookieHeader);
  }

  private extractAuthorizationToken(authorization?: unknown) {
    if (typeof authorization !== 'string') return undefined;

    return authorization.startsWith('Bearer ')
      ? this.normalizeToken(authorization.split(' ')[1])
      : undefined;
  }

  private extractCookieToken(cookieHeader?: string) {
    if (!cookieHeader) return undefined;

    return cookieHeader
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith('access_token='))
      ?.split('=')
      .slice(1)
      .join('=');
  }

  private normalizeToken(token?: unknown) {
    if (typeof token !== 'string' || token.length === 0) return undefined;

    return token.startsWith('Bearer ') ? token.split(' ')[1] : token;
  }
}
