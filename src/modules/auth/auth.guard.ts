import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { ConfigService } from '@nestjs/config';

interface JwtPayload {
  email: string;
  sub: number;
  iat: number;
  exp: number;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    protected readonly jwtService: JwtService,
    protected readonly configService: ConfigService,
    protected readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const cookie_token = request.cookies?.access_token as string;

    let headers_token = request.headers['authorization'] || request.headers['Authorization'];
    if (headers_token && typeof headers_token === 'string' && headers_token.startsWith('Bearer ')) {
      headers_token = headers_token.split(' ')[1];
    }

    const access_token = cookie_token || headers_token;

    if (!access_token) {
      throw new UnauthorizedException('Authorization is missing');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync(access_token, {
        secret: this.configService.getOrThrow('JWT_SECRET'),
      });
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      }
      throw new UnauthorizedException('Invalid token');
    }

    const { email, id } = await this.userService.findOne(payload.email);

    request['user'] = { email, id };
    return true;
  }
}
