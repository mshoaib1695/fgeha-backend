import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyBulletin } from './entities/daily-bulletin.entity';
import { DailyBulletinService } from './daily-bulletin.service';
import { DailyBulletinController } from './daily-bulletin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DailyBulletin])],
  controllers: [DailyBulletinController],
  providers: [DailyBulletinService],
  exports: [DailyBulletinService],
})
export class DailyBulletinModule {}
