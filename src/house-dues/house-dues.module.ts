import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { UsersModule } from '../users/users.module';
import { SubSector } from '../users/entities/sub-sector.entity';
import { User } from '../users/entities/user.entity';
import { HouseDuesController } from './house-dues.controller';
import { HouseDueCategory } from './entities/house-due-category.entity';
import { HouseDueEntry } from './entities/house-due-entry.entity';
import { HouseDue } from './entities/house-due.entity';
import { HouseDuesService } from './house-dues.service';

@Module({
  imports: [TypeOrmModule.forFeature([HouseDue, HouseDueEntry, HouseDueCategory, User, SubSector]), AppSettingsModule, UsersModule],
  controllers: [HouseDuesController],
  providers: [HouseDuesService],
  exports: [HouseDuesService],
})
export class HouseDuesModule {}
