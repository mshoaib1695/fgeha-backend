import { IsInt, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRequestDto {
  @IsInt()
  @Type(() => Number)
  requestTypeId: number;

  @IsInt()
  @Type(() => Number)
  requestTypeOptionId: number;

  @IsString()
  @MinLength(1, { message: 'House number is required' })
  houseNo: string;

  @IsString()
  @MinLength(1, { message: 'Street number is required' })
  streetNo: string;

  @IsInt()
  @Type(() => Number)
  subSectorId: number;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => (o.description?.trim?.()?.length ?? 0) > 0)
  @MinLength(10, { message: 'Description must be at least 10 characters when provided' })
  description?: string;
}
