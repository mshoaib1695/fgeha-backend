import { IsEnum } from 'class-validator';
import { RequestStatus } from '../entities/request.entity';

export class UpdateRequestStatusDto {
  @IsEnum(RequestStatus)
  status: RequestStatus;
}
