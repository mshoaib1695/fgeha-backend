import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

export interface JwtPayload {
  sub: number;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const ok = await this.usersService.validatePassword(password, user.password);
    if (!ok) return null;
    return user;
  }

  async login(user: User | Omit<User, 'password'>): Promise<{ access_token: string; user: Omit<User, 'password'> }> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const access_token = this.jwtService.sign(payload);
    const { password: _, ...rest } = user as User;
    return { access_token, user: rest };
  }

  async register(createUserDto: Parameters<UsersService['create']>[0]) {
    return this.usersService.create(createUserDto);
  }

}
