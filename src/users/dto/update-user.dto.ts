import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApprovalStatus, UserRole } from '../entities/user.entity';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsEnum(ApprovalStatus)
  approvalStatus?: ApprovalStatus;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  /** Profile image as base64 data URL (data:image/jpeg;base64,...). Uploaded and stored on server. */
  @IsOptional()
  @IsString()
  profileImage?: string;

  /** Same as profileImage; allow snake_case from client. */
  @IsOptional()
  @IsString()
  profile_image?: string;
}
