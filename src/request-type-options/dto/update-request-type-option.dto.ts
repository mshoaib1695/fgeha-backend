import { PartialType } from '@nestjs/swagger';
import { CreateRequestTypeOptionDto } from './create-request-type-option.dto';

export class UpdateRequestTypeOptionDto extends PartialType(CreateRequestTypeOptionDto) {}
