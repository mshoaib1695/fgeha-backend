import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { RequestStatus } from '../entities/request.entity';

export class UpdateRequestDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  requestTypeId?: number;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'House number is required' })
  houseNo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Street number is required' })
  streetNo?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  subSectorId?: number;

  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => (o.description?.trim?.()?.length ?? 0) > 0)
  @MinLength(10, { message: 'Description must be at least 10 characters when provided' })
  description?: string;
}
