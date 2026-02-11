import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
@Entity('request_types')
export class RequestTypeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  slug: string;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  /** Request number prefix, e.g. WTR -> WTR#0001. Configurable per request type. */
  @Column({ name: 'request_number_prefix', type: 'varchar', length: 20, nullable: true })
  requestNumberPrefix: string | null;

  /** Zero-padding length for request number suffix (e.g. 4 -> 0001). */
  @Column({ name: 'request_number_padding', type: 'int', default: 4 })
  requestNumberPadding: number;

  /** Next sequence number to allocate for this request type. */
  @Column({ name: 'request_number_next', type: 'int', default: 1 })
  requestNumberNext: number;

  /** Optional: icon/image URL for app home (e.g. /request-type-icons/water.svg or full URL). */
  @Column({ name: 'icon_url', type: 'varchar', length: 500, nullable: true })
  iconUrl: string | null;

  /** Optional: allow requests only in this time window (e.g. "13:00" to "14:00"). Null = no restriction. */
  @Column({ name: 'restriction_start_time', type: 'varchar', length: 5, nullable: true })
  restrictionStartTime: string | null;

  @Column({ name: 'restriction_end_time', type: 'varchar', length: 5, nullable: true })
  restrictionEndTime: string | null;

  /** Optional: comma-separated day numbers 0=Sun, 1=Mon, ..., 6=Sat (e.g. "1,2,3,4,5" = Mon–Fri). Null = no restriction. */
  @Column({ name: 'restriction_days', type: 'varchar', length: 20, nullable: true })
  restrictionDays: string | null;

  /**
   * Optional: limit one request per (type + same house + street + sector) in this period.
   * Values: 'none' | 'day' | 'week' | 'month'. Default 'none'.
   */
  @Column({ name: 'duplicate_restriction_period', type: 'varchar', length: 10, nullable: true, default: 'none' })
  duplicateRestrictionPeriod: string | null;

  /** When true, app shows under-construction screen with underConstructionMessage instead of options/form. */
  @Column({ name: 'under_construction', type: 'boolean', default: false })
  underConstruction: boolean;

  @Column({ name: 'under_construction_message', type: 'text', nullable: true })
  underConstructionMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany('Request', 'requestType')
  requests: any[];
}
