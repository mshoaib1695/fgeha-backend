import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateHouseDueCategoryDto {
  @ApiProperty({ example: 'Water Tanker Charges' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ enum: ['charge', 'payment', 'both'], example: 'charge' })
  @IsOptional()
  @IsIn(['charge', 'payment', 'both'])
  usage?: 'charge' | 'payment' | 'both';
}
