import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

export type Meta = {
  total?: number;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
  [key: string]: any;
};

export type ApiResponse<T> = {
  data: T;
  meta?: Meta;
};

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'data' in data) {
          return data;
        }

        return {
          data,
          meta: {},
        };
      }),
    );
  }
}
