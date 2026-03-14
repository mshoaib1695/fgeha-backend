import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApprovedUserGuard } from '../auth/guards/approved-user.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, User } from '../users/entities/user.entity';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly service: FeedbackService) {}

  @UseGuards(JwtAuthGuard, ApprovedUserGuard)
  @ApiBearerAuth('JWT')
  @Post()
  create(@Body() dto: CreateFeedbackDto, @CurrentUser() user: User) {
    return this.service.create(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @Get()
  async findAll(@CurrentUser() user: User) {
    const data = await this.service.findAll();
    return { data, total: data.length };
  }
}
