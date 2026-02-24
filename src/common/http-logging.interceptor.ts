import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const { method, url, ip } = req;
    const userAgent = req.get('user-agent') ?? '';
    const user = (req as Request & { user?: { id?: number; email?: string } }).user;
    const start = Date.now();

    Sentry.addBreadcrumb({
      category: 'http',
      message: `${method} ${url}`,
      level: 'info',
      data: { method, url, ip, userAgent, userId: user?.id },
    });

    return next.handle().pipe(
      tap(() => {
        const res = http.getResponse();
        const statusCode = res.statusCode;
        const durationMs = Date.now() - start;
        Sentry.addBreadcrumb({
          category: 'http',
          message: `${method} ${url} → ${statusCode}`,
          level: 'info',
          data: { statusCode, durationMs },
        });
        this.logger.log(
          `${method} ${url} ${statusCode} ${durationMs}ms - ${ip} ${userAgent.slice(0, 60)}`,
        );
      }),
      catchError((err) => {
        const statusCode = err.status ?? err.statusCode ?? 500;
        const durationMs = Date.now() - start;
        const message = err.message ?? String(err);
        Sentry.addBreadcrumb({
          category: 'http',
          message: `${method} ${url} → ${statusCode}`,
          level: statusCode >= 500 ? 'error' : 'warning',
          data: { statusCode, durationMs, message },
        });
        this.logger.warn(
          `${method} ${url} ${statusCode} ${durationMs}ms - ${message} - ${ip}`,
        );
        if (statusCode >= 500 && err.stack) this.logger.error(err.stack);
        throw err;
      }),
    );
  }
}
