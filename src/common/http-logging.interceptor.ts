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

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HttpRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const { method, url, ip } = req;
    const userAgent = req.get('user-agent') ?? '';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = http.getResponse();
        const statusCode = res.statusCode;
        const durationMs = Date.now() - start;
        this.logger.log(
          `${method} ${url} ${statusCode} ${durationMs}ms - ${ip} ${userAgent.slice(0, 60)}`,
        );
      }),
      catchError((err) => {
        const res = http.getResponse();
        const statusCode = err.status ?? err.statusCode ?? 500;
        const durationMs = Date.now() - start;
        const message = err.message ?? String(err);
        this.logger.warn(
          `${method} ${url} ${statusCode} ${durationMs}ms - ${message} - ${ip}`,
        );
        if (statusCode >= 500 && err.stack) {
          this.logger.error(err.stack);
        }
        throw err;
      }),
    );
  }
}
