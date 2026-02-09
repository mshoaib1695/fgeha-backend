import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestTypeOptionEntity } from './entities/request-type-option.entity';
import { RequestTypeOptionsService } from './request-type-options.service';
import { RequestTypeOptionsController } from './request-type-options.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RequestTypeOptionEntity])],
  controllers: [RequestTypeOptionsController],
  providers: [RequestTypeOptionsService],
  exports: [RequestTypeOptionsService],
})
export class RequestTypeOptionsModule {}
