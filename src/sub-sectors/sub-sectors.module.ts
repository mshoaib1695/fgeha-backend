import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubSectorsController } from './sub-sectors.controller';
import { SubSectorsService } from './sub-sectors.service';
import { SubSector } from '../users/entities/sub-sector.entity';
import { User } from '../users/entities/user.entity';
import { Request } from '../requests/entities/request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubSector, User, Request]),
  ],
  controllers: [SubSectorsController],
  providers: [SubSectorsService],
  exports: [SubSectorsService],
})
export class SubSectorsModule {}
