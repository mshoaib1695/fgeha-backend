import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type HouseDueEntryType = 'charge' | 'payment' | 'adjustment';

@Entity('house_due_entries')
@Index('idx_house_due_entries_house_due_id', ['houseDueId'])
export class HouseDueEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'house_due_id', type: 'int' })
  houseDueId: number;

  @Column({ name: 'entry_type', type: 'varchar', length: 20 })
  entryType: HouseDueEntryType;

  @Column({ name: 'category', type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ name: 'signed_amount', type: 'decimal', precision: 12, scale: 2 })
  signedAmount: string;

  @Column({ name: 'reference', type: 'varchar', length: 100, nullable: true })
  reference: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by_admin_id', type: 'int', nullable: true })
  createdByAdminId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
