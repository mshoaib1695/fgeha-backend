import {
  IsEmail,
  IsString,
  MinLength,
  IsInt,
  IsOptional,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(100)
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @IsString()
  @Matches(/^\+?[0-9]{1,4}$/, {
    message: 'Phone country code must be valid (e.g. +92, 1)',
  })
  @MaxLength(10)
  phoneCountryCode: string;

  @IsString()
  @Matches(/^[0-9]{7,15}$/, {
    message: 'Phone number must be 7–15 digits',
  })
  phoneNumber: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  houseNo: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  streetNo: string;

  @IsInt()
  @Type(() => Number)
  subSectorId: number;

  /** ID card image as base64 data URL (e.g. data:image/jpeg;base64,...) or URL. Optional on register; can upload later. */
  @IsOptional()
  @IsString()
  idCardPhoto?: string;

  /** ID card front image as base64 data URL (data:image/jpeg;base64,...). */
  @IsOptional()
  @IsString()
  idCardFront?: string;

  /** ID card back image as base64 data URL (data:image/jpeg;base64,...). */
  @IsOptional()
  @IsString()
  idCardBack?: string;
}
