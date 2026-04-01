import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type HouseDueCategoryUsage = 'charge' | 'payment' | 'both';

@Entity('house_due_categories')
@Index('idx_house_due_categories_name_unique', ['name'], { unique: true })
export class HouseDueCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: 'both' })
  usage: HouseDueCategoryUsage;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by_admin_id', type: 'int', nullable: true })
  createdByAdminId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
