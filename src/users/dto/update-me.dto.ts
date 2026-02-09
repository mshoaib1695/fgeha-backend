import {
  IsString,
  IsOptional,
  IsInt,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** DTO for PATCH /users/me – only these properties are allowed (no role/approvalStatus). */
export class UpdateMeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{1,4}$/)
  @MaxLength(10)
  phoneCountryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{7,15}$/)
  phoneNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  houseNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  streetNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subSectorId?: number;

  /** Profile image as base64 data URL (data:image/jpeg;base64,...). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profileImage?: string;
}
