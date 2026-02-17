import { PartialType } from '@nestjs/mapped-types';
import { CreateRequestTypeDto } from './create-request-type.dto';

export class UpdateRequestTypeDto extends PartialType(CreateRequestTypeDto) {}
