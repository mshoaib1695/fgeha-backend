import { Controller, Post, Body, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApprovedUserGuard } from './guards/approved-user.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { UserRole } from '../users/entities/user.entity';

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