import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestTypeEntity } from './entities/request-type.entity';
import { RequestTypesService } from './request-types.service';
import { RequestTypesController } from './request-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RequestTypeEntity])],
  controllers: [RequestTypesController],
  providers: [RequestTypesService],
  exports: [RequestTypesService],
})
export class RequestTypesModule {}
