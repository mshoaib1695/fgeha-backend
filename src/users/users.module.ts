import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MailService } from './mail.service';
import { User } from './entities/user.entity';
import { SubSector } from './entities/sub-sector.entity';
import { Request } from '../requests/entities/request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, SubSector, Request])],
  controllers: [UsersController],
  providers: [UsersService, MailService],
  exports: [UsersService],
})
export class UsersModule {}
