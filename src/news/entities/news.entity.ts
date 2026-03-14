import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('news')
export class News {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  /** Rich text content (HTML or Markdown). */
  @Column({ type: 'longtext', nullable: true })
  content: string | null;

  /** Relative path e.g. news-images/xxx.jpg (required) */
  @Column({ name: 'image_url', type: 'varchar', length: 512 })
  imageUrl: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  /** When true, tapping the carousel slide opens the detail page. Default true. */
  @Column({ name: 'open_detail', type: 'tinyint', default: 1 })
  openDetail: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
