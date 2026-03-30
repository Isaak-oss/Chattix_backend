import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Response } from 'express';
import { authCookieConfig } from '../configs/auth-cookie-config';

@Injectable()
export class SetAccessTokenInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap((data) => {
        if (!data || !data?.access_token) return;

        if (data.access_token) {
          res.cookie(
            process.env.ACCESS_COOKIE_KEY ?? 'access_token',
            data.access_token,
            authCookieConfig,
          );
        }

        if (data.logout) {
          res.clearCookie(process.env.ACCESS_COOKIE_KEY ?? 'access_token', {
            httpOnly: true,
            sameSite: 'strict',
          });
        }
      }),
    );
  }
}
