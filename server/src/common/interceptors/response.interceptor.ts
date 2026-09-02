import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  requestId: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<{ requestId?: string }>();
    const requestId = request.requestId ?? randomUUID();
    request.requestId = requestId;

    return next.handle().pipe(map((data) => ({ code: 0, message: 'success', data, requestId })));
  }
}
