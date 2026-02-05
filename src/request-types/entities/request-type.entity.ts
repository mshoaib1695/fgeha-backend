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

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany('Request', 'requestType')
  requests: any[];
}
