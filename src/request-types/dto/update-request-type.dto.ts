import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateRequestTypeDto } from './create-request-type.dto';

export class UpdateRequestTypeDto extends PartialType(CreateRequestTypeDto) {
  /** Optional admin override for generated request number prefix (e.g. WTR -> WTR#0001). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  requestNumberPrefix?: string | null;
}
