import { Controller, Post, Body, Get, UseGuards, ForbiddenException, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApprovedUserGuard } from './guards/approved-user.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { UserRole } from '../users/entities/user.entity';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Public()
  @Get('verify-email')
  async verifyEmailGet(@Query('token') token: string, @Res() res: Response) {
    try {
      const { email } = await this.authService.verifyEmail(token || '');
      res.setHeader('Content-Type', 'text/html');
      res.send(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Email verified</title></head><body style="font-family:sans-serif;max-width:480px;margin:60px auto;padding:24px;"><h1>Email verified</h1><p>Your email <strong>${escapeHtml(email)}</strong> has been verified. You can now sign in to the app.</p></body></html>`,
      );
    } catch {
      res.setHeader('Content-Type', 'text/html');
      res.status(400).send(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Verification failed</title></head><body style="font-family:sans-serif;max-width:480px;margin:60px auto;padding:24px;"><h1>Verification failed</h1><p>This link is invalid or has expired. Please request a new verification code from the app.</p></body></html>`,
      );
    }
  }

  @Public()
  @Post('verify-email')
  verifyEmailByCode(@Body() body: { email: string; code: string }) {
    return this.authService.verifyEmailByCode(body?.email ?? '', body?.code ?? '');
  }

  @Public()
  @Post('resend-verification-code')
  async resendVerificationCode(@Body() body: { email: string }) {
    await this.authService.resendVerificationCode(body?.email ?? '');
    return { message: 'If this email is registered and not yet verified, a new code has been sent.' };
  }

  @Public()
  @UseGuards(AuthGuard('local'), ApprovedUserGuard)
  @Post('login')
  login(@Body() _body: LoginDto, @CurrentUser() user: { id: number; email: string; fullName: string; role: string; approvalStatus: string }) {
    if (user.role !== UserRole.USER) {
      throw new ForbiddenException('App access only for user role');
    }
    return this.authService.login(user as any);
  }

  @Public()
  @UseGuards(AuthGuard('local'), ApprovedUserGuard)
  @Post('admin-login')
  adminLogin(@Body() _body: LoginDto, @CurrentUser() user: { id: number; email: string; fullName: string; role: string; approvalStatus: string }) {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin access only');
    }
    return this.authService.login(user as any);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('me')
  me(@CurrentUser() user: { id: number; email: string; fullName: string; role: string; approvalStatus: string }) {
    return user;
  }
}