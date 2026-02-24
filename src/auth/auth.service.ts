import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

export interface JwtPayload {
  sub: number;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.log(`Login failed: no user for email=${email}`);
      return null;
    }
    const ok = await this.usersService.validatePassword(password, user.password);
    if (!ok) {
      this.logger.log(`Login failed: invalid password for email=${email}`);
      return null;
    }
    return user;
  }

  async login(user: User | Omit<User, 'password'>): Promise<{ access_token: string; user: Omit<User, 'password'> }> {
    this.logger.log(`Login success userId=${user.id} email=${user.email}`);
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload);
    const { password: _, ...rest } = user as User;
    return { access_token, user: rest };
  }

  async register(createUserDto: Parameters<UsersService['create']>[0]) {
    this.logger.log(`Register attempt email=${createUserDto?.email ?? 'unknown'}`);
    return this.usersService.create(createUserDto);
  }

  async verifyEmail(token: string): Promise<{ email: string }> {
    this.logger.log(`Verify email (token) attempt tokenLength=${token?.length ?? 0}`);
    return this.usersService.verifyEmail(token);
  }

  async verifyEmailByCode(email: string, code: string): Promise<{ email: string }> {
    this.logger.log(`Verify email by code attempt email=${email}`);
    return this.usersService.verifyEmailByCode(email, code);
  }

  async resendVerificationCode(email: string): Promise<void> {
    this.logger.log(`Resend verification code attempt email=${email}`);
    return this.usersService.resendVerificationCode(email);
  }

  async requestPasswordReset(email: string): Promise<void> {
    this.logger.log(`Forgot password attempt email=${email}`);
    return this.usersService.requestPasswordReset(email);
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    this.logger.log(`Reset password attempt email=${email}`);
    return this.usersService.resetPasswordWithCode(email, code, newPassword);
  }
}
