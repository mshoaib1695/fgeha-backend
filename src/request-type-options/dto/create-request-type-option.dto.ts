import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsObject, IsOptional, MaxLength } from 'class-validator';

export type OptionType = 'form' | 'list' | 'rules' | 'notification' | 'link' | 'phone';

export class CreateRequestTypeOptionDto {
  @ApiProperty()
  @IsNumber()
  requestTypeId: number;

  @ApiProperty({ example: 'Order Water Tanker', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  label: string;

  @ApiPropertyOptional({
    example: 'order_water_tanker',
    description: 'Optional slug for analytics/report filters. Auto-generated from label if omitted.',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string | null;

  @ApiProperty({ enum: ['form', 'list', 'rules', 'notification', 'link', 'phone'] })
  @IsEnum(['form', 'list', 'rules', 'notification', 'link', 'phone'])
  optionType: OptionType;

  @ApiPropertyOptional({
    description: 'JSON: form={ issueImage: "none"|"optional"|"required" }, list={ listKey }, rules={ content|rules[] }, notification={ content }, link={ url }, phone={ phoneNumber }',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Image URL (e.g. from upload)', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Header icon: Ionicons name (e.g. list-outline, document-text-outline) or single emoji (e.g. 📋). Shown in app screen header.',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  headerIcon?: string | null;

  @ApiPropertyOptional({
    description: 'Hint text shown under option label in app (e.g. "Submit a request", "Open list"). Leave empty for default per type.',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  hint?: string | null;

  @ApiPropertyOptional({
    description: 'Request ID prefix for this service option (e.g. OWT -> OWT#0001)',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  requestNumberPrefix?: string | null;

  /** Optional: limit one request per (same house + street + sector) in this period. Values: none, day, week, month. Only for form options. */
  @ApiPropertyOptional({ enum: ['none', 'day', 'week', 'month'], maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  duplicateRestrictionPeriod?: string | null;

  /** Optional: e.g. "13:00" – requests only after this time (within restriction days). */
  @ApiPropertyOptional({ maxLength: 5 })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  restrictionStartTime?: string | null;

  /** Optional: e.g. "14:00" – requests only before this time. */
  @ApiPropertyOptional({ maxLength: 5 })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  restrictionEndTime?: string | null;

  /** Optional: comma-separated 0–6 (0=Sun, 1=Mon, …, 6=Sat), e.g. "1,2,3,4,5" for Mon–Fri. */
  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  restrictionDays?: string | null;
}
