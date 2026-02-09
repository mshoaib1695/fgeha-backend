import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, User } from '../users/entities/user.entity';
import { DailyBulletinService } from './daily-bulletin.service';
import { CreateDailyBulletinDto } from './dto/create-daily-bulletin.dto';
import { Public } from '../auth/decorators/public.decorator';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@ApiTags('daily-bulletin')
@Controller('daily-bulletin')
export class DailyBulletinController {
  constructor(private readonly service: DailyBulletinService) {}

  /** Public / app: get today's water tanker bulletin (if any). */
  @Public()
  @Get('today')
  getToday() {
    return this.service.findToday();
  }

  /** Public / app: get bulletin for a specific date (YYYY-MM-DD). */
  @Public()
  @Get('by-date/:date')
  getByDate(@Param('date') date: string) {
    return this.service.findByDate(date);
  }

  /** Admin: list all bulletins. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Get()
  async findAll(@CurrentUser() user: User) {
    const data = await this.service.findAll();
    return { data, total: data.length };
  }

  /** Admin: upload PDF, CSV, or Excel and set bulletin for a date (creates or replaces). */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        date: { type: 'string', example: '2025-02-05' },
        title: { type: 'string', example: 'Water tanker schedule for today' },
        description: { type: 'string' },
      },
      required: ['file', 'date', 'title'],
    },
  })
  async create(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE })],
        fileIsRequired: true,
      }),
    )
    file: { buffer: Buffer; mimetype: string },
    @Body() dto: CreateDailyBulletinDto,
    @CurrentUser() user: User,
  ) {
    return this.service.upsert(dto, file);
  }

  /** Admin: delete bulletin for a date. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Delete(':date')
  remove(@Param('date') date: string, @CurrentUser() user: User) {
    return this.service.removeByDate(date);
  }
}
