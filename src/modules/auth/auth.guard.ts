import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthTokenService } from './auth-token.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authTokenService: AuthTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.authTokenService.extractHttpToken(request);
    const user = await this.authTokenService.authenticateToken(token);

    request['user'] = user;
    return true;
  }
}
