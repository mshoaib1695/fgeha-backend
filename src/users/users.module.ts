import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MailService } from './mail.service';
import { User } from './entities/user.entity';
import { SubSector } from './entities/sub-sector.entity';
import { Request } from '../requests/entities/request.entity';
import { PushService } from './push.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, SubSector, Request])],
  controllers: [UsersController],
  providers: [UsersService, MailService, PushService],
  exports: [UsersService, MailService, PushService],
})
export class UsersModule {}
