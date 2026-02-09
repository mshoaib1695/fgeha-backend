import { IsOptional, IsInt, IsEnum, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '../entities/request.entity';

export class FindRequestsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by request type ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requestTypeId?: number;

  @ApiPropertyOptional({ enum: RequestStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiPropertyOptional({ description: 'From date (ISO date string, inclusive)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'To date (ISO date string, inclusive)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  /** Refine REST pagination: start index (inclusive) */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  _start?: number;

  /** Refine REST pagination: end index (exclusive) */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  _end?: number;
}
