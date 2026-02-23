import { IsString, MinLength, MaxLength } from 'class-validator';

export class CancelRequestDto {
  @IsString()
  @MinLength(1, { message: 'Please provide a reason for cancelling' })
  @MaxLength(500)
  reason: string;
}
