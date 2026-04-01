import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListHouseDuesQueryDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  subSectorId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  houseNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  streetNo?: string;
}
