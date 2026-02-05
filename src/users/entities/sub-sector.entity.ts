import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('sub_sectors')
export class SubSector {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  name: string;

  @Column({ length: 20, unique: true })
  code: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
}
