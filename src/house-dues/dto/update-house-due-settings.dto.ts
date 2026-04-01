import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateHouseDueSettingsDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subSectorId: number;

  @ApiProperty({ example: '14' })
  @IsString()
  houseNo: string;

  @ApiProperty({ example: '17' })
  @IsString()
  streetNo: string;

  @ApiPropertyOptional({ example: 30 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  graceDays?: number;

  @ApiPropertyOptional({ example: true })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'Please clear dues by due date.' })
  @IsOptional()
  @IsString()
  noticeMessage?: string;
}
