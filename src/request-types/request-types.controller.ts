import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { RequestTypesService } from './request-types.service';
import { CreateRequestTypeDto } from './dto/create-request-type.dto';
import { UpdateRequestTypeDto } from './dto/update-request-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { User } from '../users/entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';

const MAX_ICON_SIZE = 1024 * 1024;

@ApiTags('request-types')
@Controller('request-types')
export class RequestTypesController {
  constructor(private readonly requestTypesService: RequestTypesService) {}

  /** Public: list request types (e.g. for app dropdown) */
  @Public()
  @Get()
  findAll() {
    return this.requestTypesService.findAll();
  }

  /** Admin: upload icon (SVG/image); returns { url } to set as iconUrl. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Post('upload-icon')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ICON_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  async uploadIcon(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_ICON_SIZE })],
      }),
    )
    file: { buffer: Buffer; originalname: string; mimetype: string },
    @CurrentUser() user: User,
  ) {
    return this.requestTypesService.uploadIcon(
      file.buffer,
      file.originalname,
      file.mimetype,
      user as User,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.requestTypesService.findOne(+id, user as User);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Post()
  create(@Body() dto: CreateRequestTypeDto, @CurrentUser() user: User) {
    return this.requestTypesService.create(dto, user as User);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRequestTypeDto,
    @CurrentUser() user: User,
  ) {
    return this.requestTypesService.update(+id, dto, user as User);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.requestTypesService.remove(+id, user as User);
  }
}
