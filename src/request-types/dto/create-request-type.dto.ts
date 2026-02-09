import { IsString, IsOptional, IsInt, IsBoolean, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRequestTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  slug: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  displayOrder?: number;

  /** Optional: icon URL (relative path like /request-type-icons/water.svg or full URL). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  iconUrl?: string | null;

  /** Optional: e.g. "13:00" – requests only after this time (within restriction days). */
  @IsOptional()
  @IsString()
  @MaxLength(5)
  restrictionStartTime?: string;

  /** Optional: e.g. "14:00" – requests only before this time. */
  @IsOptional()
  @IsString()
  @MaxLength(5)
  restrictionEndTime?: string;

  /** Optional: comma-separated 0–6 (0=Sun, 1=Mon, …, 6=Sat), e.g. "1,2,3,4,5" for Mon–Fri. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  restrictionDays?: string;

  /** Optional: limit one request per (same house + street + sector) in this period. Values: none, day, week, month. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  duplicateRestrictionPeriod?: string;

  /** When true, app shows under-construction screen with message instead of options/form. */
  @IsOptional()
  @IsBoolean()
  underConstruction?: boolean;

  @IsOptional()
  @IsString()
  underConstructionMessage?: string | null;
}
