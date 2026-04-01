import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../users/entities/user.entity';
import { ListHouseDuesQueryDto } from './dto/list-house-dues-query.dto';
import { UpsertHouseDueDto } from './dto/upsert-house-due.dto';
import { AddHouseDueEntryDto } from './dto/add-house-due-entry.dto';
import { UpdateHouseDueSettingsDto } from './dto/update-house-due-settings.dto';
import { HouseDuesService } from './house-dues.service';
import { CreateHouseDueCategoryDto } from './dto/create-house-due-category.dto';
import { UpdateHouseDueCategoryDto } from './dto/update-house-due-category.dto';

@ApiTags('house-dues')
@Controller('house-dues')
export class HouseDuesController {
  constructor(private readonly houseDuesService: HouseDuesService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('my-status')
  getMyStatus(@CurrentUser() user: User) {
    return this.houseDuesService.getMyStatus(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Post('admin/upsert')
  upsertAdmin(@Body() dto: UpsertHouseDueDto, @CurrentUser() user: User) {
    return this.houseDuesService.upsertAdmin(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Post('admin/entries')
  addEntryAdmin(@Body() dto: AddHouseDueEntryDto, @CurrentUser() user: User) {
    return this.houseDuesService.addEntryAdmin(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Patch('admin/settings')
  updateSettingsAdmin(@Body() dto: UpdateHouseDueSettingsDto, @CurrentUser() user: User) {
    return this.houseDuesService.updateSettingsAdmin(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Get('admin/list')
  listAdmin(@Query() query: ListHouseDuesQueryDto, @CurrentUser() user: User) {
    return this.houseDuesService.listAdmin(query, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Get('admin/by-house')
  getByHouseAdmin(
    @Query('subSectorId') subSectorId: string,
    @Query('houseNo') houseNo: string,
    @Query('streetNo') streetNo: string,
    @CurrentUser() user: User,
  ) {
    return this.houseDuesService.getByHouseAdmin(
      {
        subSectorId: Number(subSectorId),
        houseNo,
        streetNo,
      },
      user,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Get('admin/ledger')
  getLedgerAdmin(
    @Query('subSectorId') subSectorId: string,
    @Query('houseNo') houseNo: string,
    @Query('streetNo') streetNo: string,
    @CurrentUser() user: User,
  ) {
    return this.houseDuesService.ledgerAdmin(
      {
        subSectorId: Number(subSectorId),
        houseNo,
        streetNo,
      },
      user,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Get('admin/categories')
  listCategoriesAdmin(@Query('includeInactive') includeInactive: string, @CurrentUser() user: User) {
    return this.houseDuesService.listCategoriesAdmin(user, includeInactive === 'true');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Post('admin/categories')
  createCategoryAdmin(@Body() dto: CreateHouseDueCategoryDto, @CurrentUser() user: User) {
    return this.houseDuesService.createCategoryAdmin(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Patch('admin/categories/:id')
  updateCategoryAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHouseDueCategoryDto,
    @CurrentUser() user: User,
  ) {
    return this.houseDuesService.updateCategoryAdmin(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Post('admin/entries/bulk-upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        dryRun: { type: 'boolean', default: false },
        stopOnError: { type: 'boolean', default: false },
      },
      required: ['file'],
    },
  })
  bulkUploadEntriesAdmin(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
    @Body('dryRun') dryRunRaw: string | boolean | undefined,
    @Body('stopOnError') stopOnErrorRaw: string | boolean | undefined,
    @CurrentUser() user: User,
  ) {
    const dryRun = String(dryRunRaw ?? 'false') === 'true';
    const stopOnError = String(stopOnErrorRaw ?? 'false') === 'true';
    return this.houseDuesService.bulkUploadAdmin(file, { dryRun, stopOnError }, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Get('admin/import-jobs/:importId')
  getImportJobAdmin(@Param('importId') importId: string, @CurrentUser() user: User) {
    return this.houseDuesService.getBulkImportJobAdmin(importId, user);
  }
}
