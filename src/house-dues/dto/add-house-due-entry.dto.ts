import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class AddHouseDueEntryDto {
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

  @ApiProperty({ enum: ['charge', 'payment', 'adjustment'], example: 'charge' })
  @IsIn(['charge', 'payment', 'adjustment'])
  entryType: 'charge' | 'payment' | 'adjustment';

  @ApiPropertyOptional({ enum: ['debit', 'credit'], example: 'debit' })
  @IsOptional()
  @IsIn(['debit', 'credit'])
  adjustmentDirection?: 'debit' | 'credit';

  @ApiProperty({ example: 'Water tanker surcharge' })
  @IsString()
  category: string;

  @ApiProperty({ example: 1200.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'REC-2026-001' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'March ledger entry' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'Please clear outstanding within 30 days.' })
  @IsOptional()
  @IsString()
  noticeMessage?: string;

  @ApiPropertyOptional({ example: 30 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  graceDays?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  isActive?: boolean;
}
