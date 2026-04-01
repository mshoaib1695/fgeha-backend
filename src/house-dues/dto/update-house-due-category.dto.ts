import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateHouseDueCategoryDto {
  @ApiPropertyOptional({ example: 'Water Tanker Charges' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ['charge', 'payment', 'both'], example: 'charge' })
  @IsOptional()
  @IsIn(['charge', 'payment', 'both'])
  usage?: 'charge' | 'payment' | 'both';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
