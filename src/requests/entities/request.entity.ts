import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { RequestTypeEntity } from '../../request-types/entities/request-type.entity';
import { RequestTypeOptionEntity } from '../../request-type-options/entities/request-type-option.entity';

export enum RequestStatus {
  PENDING = 'pending',
  CANCELLED = 'cancelled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  /** Legacy value kept for backward compatibility with old rows. */
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

  @Index('idx_requests_request_type_option_id')
  @Column({ name: 'request_type_option_id', nullable: true })
  requestTypeOptionId: number | null;

  @ManyToOne(() => RequestTypeOptionEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'request_type_option_id' })
  requestTypeOption: RequestTypeOptionEntity | null;

  /** Human-friendly request number, e.g. WTR#0001. Legacy rows may be null. */
  @Column({ name: 'request_number', type: 'varchar', length: 40, nullable: true })
  requestNumber: string | null;

  @Column({ type: 'text' })
  description: string;

  /** Optional issue image uploaded with this request. */
  @Column({ name: 'issue_image_url', type: 'varchar', length: 500, nullable: true })
  issueImageUrl: string | null;

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
