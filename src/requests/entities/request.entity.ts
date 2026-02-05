import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RequestTypeEntity } from '../../request-types/entities/request-type.entity';

export enum RequestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

@Entity('requests')
export class Request {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'request_type_id' })
  requestTypeId: number;

  @ManyToOne(() => RequestTypeEntity, (type) => type.requests, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'request_type_id' })
  requestType: RequestTypeEntity;

  @Column({ type: 'text' })
  description: string;

  /** Address this request is for (allows creating on behalf of another house). */
  @Column({ name: 'house_no', length: 50 })
  houseNo: string;

  @Column({ name: 'street_no', length: 50 })
  streetNo: string;

  @Column({ name: 'sub_sector_id' })
  subSectorId: number;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.requests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
