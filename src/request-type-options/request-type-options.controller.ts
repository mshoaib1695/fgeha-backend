import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { RequestTypeOptionsService } from './request-type-options.service';
import { CreateRequestTypeOptionDto } from './dto/create-request-type-option.dto';
import { UpdateRequestTypeOptionDto } from './dto/update-request-type-option.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

@ApiTags('request-type-options')
@Controller('request-type-options')
export class RequestTypeOptionsController {
  constructor(private readonly service: RequestTypeOptionsService) {}

  /** Public / app: get options for a request type. */
  @Get('by-request-type/:requestTypeId')
  findByRequestType(@Param('requestTypeId') requestTypeId: string) {
    return this.service.findByRequestType(+requestTypeId);
  }

  /** Admin: upload image for service option; returns { url } to set as imageUrl. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE },
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
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE })],
      }),
    )
    file: { buffer: Buffer; originalname: string; mimetype: string },
    @CurrentUser() user: User,
  ) {
    return this.service.uploadImage(
      file.buffer,
      file.originalname,
      file.mimetype,
      user as User,
    );
  }

  /** Admin: list options (optional ?requestTypeId=1). Must be before @Get(':id'). */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Get()
  findAll(@Query('requestTypeId') requestTypeId?: string) {
    const id = requestTypeId ? +requestTypeId : undefined;
    return this.service.findAll(id);
  }

  /** Public / app: get one option by id (e.g. for rules content). */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  /** Admin: create option. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Post()
  create(@Body() dto: CreateRequestTypeOptionDto, @CurrentUser() user: User) {
    return this.service.create(dto, user);
  }

  /** Admin: update option. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRequestTypeOptionDto,
    @CurrentUser() user: User,
  ) {
    return this.service.update(+id, dto, user);
  }

  /** Admin: delete option. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    await this.service.remove(+id, user);
    return { success: true };
  }
}
