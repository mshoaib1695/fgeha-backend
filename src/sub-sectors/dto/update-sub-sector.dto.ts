import { PartialType } from '@nestjs/mapped-types';
import { CreateSubSectorDto } from './create-sub-sector.dto';

export class UpdateSubSectorDto extends PartialType(CreateSubSectorDto) {}
