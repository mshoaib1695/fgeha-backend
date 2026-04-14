import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false | null,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      const req = context.switchToHttp().getRequest<Request>();
      const authHeader = req.headers.authorization;
      const hasBearerToken =
        typeof authHeader === 'string' &&
        authHeader.toLowerCase().startsWith('bearer ');
      const infoObj =
        info && typeof info === 'object' ? (info as Record<string, unknown>) : null;
      const infoName = typeof infoObj?.name === 'string' ? infoObj.name : 'UnknownAuthInfo';
      const infoMessage =
        typeof infoObj?.message === 'string'
          ? infoObj.message
          : err instanceof Error
            ? err.message
            : String(info ?? err ?? 'Unauthorized');
      const expiredAt =
        infoObj?.expiredAt instanceof Date
          ? infoObj.expiredAt.toISOString()
          : undefined;

      this.logger.warn(
        `Auth rejected ${req.method} ${req.originalUrl} ip=${req.ip} bearerPresent=${hasBearerToken} reason=${infoName} message="${infoMessage}"${expiredAt ? ` expiredAt=${expiredAt}` : ''}`,
      );
      throw new UnauthorizedException('Unauthorized');
    }
    return user;
  }
}
