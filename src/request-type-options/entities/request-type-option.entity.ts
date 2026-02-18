import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { RequestTypeEntity } from '../../request-types/entities/request-type.entity';

export type OptionType = 'form' | 'list' | 'rules' | 'link' | 'phone';
export type FormIssueImageRequirement = 'none' | 'optional' | 'required';

/** Config JSON by option_type: form={}, list={ listKey: 'daily_bulletin'|'requests'|'news' }, rules={ content: string }, link={ url: string }, phone={ phoneNumber: string } */
export interface RequestTypeOptionConfig {
  issueImage?: FormIssueImageRequirement;
  listKey?: string;
  content?: string;
  rules?: Array<{ description?: string }>;
  url?: string;
  phoneNumber?: string;
}

@Entity('request_type_options')
export class RequestTypeOptionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'request_type_id' })
  requestTypeId: number;

  @ManyToOne(() => RequestTypeEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_type_id' })
  requestType: RequestTypeEntity;

  @Column({ length: 200 })
  label: string;

  /** URL/analytics friendly identifier for this option (e.g. water_tanker_order). */
  @Column({ type: 'varchar', length: 120, nullable: true })
  slug: string | null;

  @Column({ name: 'option_type', type: 'varchar', length: 20 })
  optionType: OptionType;

  /** Request number prefix for this service option (e.g. OWT -> OWT#0001). */
  @Column({ name: 'request_number_prefix', type: 'varchar', length: 20, nullable: true })
  requestNumberPrefix: string | null;

  /** Zero-padding length for request number suffix (e.g. 4 -> 0001). */
  @Column({ name: 'request_number_padding', type: 'int', default: 4 })
  requestNumberPadding: number;

  /** Next sequence number to allocate for this service option. */
  @Column({ name: 'request_number_next', type: 'int', default: 1 })
  requestNumberNext: number;

  /** JSON: form={}, list={ listKey }, rules={ content }, link={ url }, phone={ phoneNumber } */
  @Column({ type: 'json', nullable: true })
  config: RequestTypeOptionConfig | null;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  /** Optional image URL (e.g. /request-type-option-images/xxx.png). Shown on app after header. */
  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
