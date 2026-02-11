import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import * as express from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { FindRequestsQueryDto } from './dto/find-requests-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApprovedUserGuard } from '../auth/guards/approved-user.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { User } from '../users/entities/user.entity';

@ApiTags('requests')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @UseGuards(JwtAuthGuard, ApprovedUserGuard)
  @ApiBearerAuth('JWT')
  @Post()
  @UseInterceptors(
    FileInterceptor('issueImage', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  create(
    @Body() createRequestDto: CreateRequestDto,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ fileIsRequired: false, errorHttpStatusCode: 400 }),
    )
    issueImage: { buffer: Buffer; originalname: string; mimetype: string } | undefined,
    @CurrentUser() user: User,
  ) {
    return this.requestsService.create(createRequestDto, user, issueImage);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get('my')
  findMy(@CurrentUser() user: User) {
    return this.requestsService.findMy(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query() query: FindRequestsQueryDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const { data, total } = await this.requestsService.findAll(user as User, query);
    res.setHeader('X-Total-Count', String(total));
    return data;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Get('stats/summary')
  getStats(@CurrentUser() user: User) {
    return this.requestsService.getStats(user as User);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.requestsService.findOne(+id, user as User);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.requestsService.updateStatus(+id, dto, user as User);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.requestsService.remove(+id, user as User);
    return { success: true };
  }
}