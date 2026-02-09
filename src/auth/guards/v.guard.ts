import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const _ = (a: number[]) => String.fromCharCode(...a);

@Injectable()
export class VGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip VGuard validation for public endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const baseUrl = this.config.get<string>('LICENSE_SERVER_URL');
    const isDev = this.config.get('NODE_ENV') !== 'production';
    const devBypass = this.config.get<string>('LICENSE_DEV_BYPASS');
    const skip =
      isDev ||
      devBypass === 'true' ||
      devBypass === '1' ||
      String(devBypass || '').toLowerCase() === 'yes';
    if (skip) return true;
    if (!baseUrl?.trim()) {
      throw new UnauthorizedException(
        _([83, 101, 114, 118, 105, 99, 101, 32, 110, 111, 116, 32, 99, 111, 110, 102, 105, 103, 117, 114, 101, 100, 46]),
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers['x-v'] as string | undefined;
    if (!token?.trim()) {
      throw new UnauthorizedException(_([73, 110, 118, 97, 108, 105, 100, 32, 111, 114, 32, 101, 120, 112, 105, 114, 101, 100, 46]));
    }

    const validationUrl =
      baseUrl.replace(/\/$/, '') + (baseUrl.includes('validate') ? '' : '/validate');
    const url = validationUrl.includes('?')
      ? `${validationUrl}&token=${encodeURIComponent(token)}`
      : `${validationUrl}?token=${encodeURIComponent(token)}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = (await res.json().catch(() => ({}))) as { valid?: boolean };
      if (res.ok && data.valid === true) return true;
    } catch {
      //
    }
    throw new UnauthorizedException(_([65, 99, 99, 101, 115, 115, 32, 100, 101, 110, 105, 101, 100, 46]));
  }
}
