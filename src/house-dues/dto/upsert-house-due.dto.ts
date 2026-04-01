import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertHouseDueDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subSectorId: number;

  @ApiProperty({ example: '12' })
  @IsString()
  houseNo: string;

  @ApiProperty({ example: '5' })
  @IsString()
  streetNo: string;

  @ApiProperty({ example: 3500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  waterConservancyAmount: number;

  @ApiProperty({ example: 2200 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  occupancyAmount: number;

  @ApiPropertyOptional({ example: 'Please clear dues within 30 days to continue using services.' })
  @IsOptional()
  @IsString()
  noticeMessage?: string;

  @ApiPropertyOptional({ example: 30 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  graceDays?: number;

  @ApiPropertyOptional({ example: true })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
