import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { RequestTypeEntity } from '../../request-types/entities/request-type.entity';

export type OptionType = 'form' | 'list' | 'rules' | 'link';

/** Config JSON by option_type: form={}, list={ listKey: 'daily_bulletin'|'requests'|'news' }, rules={ content: string }, link={ url: string } */
export interface RequestTypeOptionConfig {
  listKey?: string;
  content?: string;
  url?: string;
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

  @Column({ name: 'option_type', type: 'varchar', length: 20 })
  optionType: OptionType;

  /** JSON: form={}, list={ listKey }, rules={ content }, link={ url } */
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
