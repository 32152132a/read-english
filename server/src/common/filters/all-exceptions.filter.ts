import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { requestId?: string }>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = exception instanceof HttpException ? exception.getResponse() : '服务器内部错误';
    const message =
      typeof detail === 'string'
        ? detail
        : ((detail as { message?: string | string[] }).message ?? '请求失败');

    response.status(status).json({
      code: status,
      message,
      data: null,
      requestId: request.requestId ?? randomUUID(),
    });
  }
}
