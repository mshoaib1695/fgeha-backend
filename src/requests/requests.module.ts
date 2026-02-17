import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { Request } from './entities/request.entity';
import { RequestTypeEntity } from '../request-types/entities/request-type.entity';
import { SubSector } from '../users/entities/sub-sector.entity';
import { RequestTypeOptionEntity } from '../request-type-options/entities/request-type-option.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Request, RequestTypeEntity, RequestTypeOptionEntity, SubSector, User]),
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
