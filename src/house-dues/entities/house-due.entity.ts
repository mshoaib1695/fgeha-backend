import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('house_dues')
@Index('idx_house_dues_house_unique', ['subSectorId', 'streetNo', 'houseNo'], { unique: true })
export class HouseDue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sub_sector_id', type: 'int' })
  subSectorId: number;

  @Column({ name: 'street_no', type: 'varchar', length: 50 })
  streetNo: string;

  @Column({ name: 'house_no', type: 'varchar', length: 50 })
  houseNo: string;

  @Column({ name: 'water_conservancy_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  waterConservancyAmount: string;

  @Column({ name: 'occupancy_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  occupancyAmount: string;

  @Column({ name: 'notice_message', type: 'text', nullable: true })
  noticeMessage: string | null;

  @Column({ name: 'notice_issued_at', type: 'datetime', nullable: true })
  noticeIssuedAt: Date | null;

  @Column({ name: 'grace_days', type: 'int', default: 30 })
  graceDays: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'updated_by_admin_id', type: 'int', nullable: true })
  updatedByAdminId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
