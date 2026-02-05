import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BulletinFileType = 'pdf' | 'csv' | 'excel';

@Entity('daily_bulletins')
export class DailyBulletin {
  @PrimaryGeneratedColumn()
  id: number;

  /** Date this bulletin is for (one bulletin per date). */
  @Column({ type: 'date', unique: true })
  date: string;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Relative path e.g. daily-files/2025-02-05-uuid.pdf */
  @Column({ name: 'file_path', length: 512 })
  filePath: string;

  @Column({ name: 'file_type', type: 'varchar', length: 10 })
  fileType: BulletinFileType;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
