import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Request } from '../../requests/entities/request.entity';
import { SubSector } from './sub-sector.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ name: 'phone_country_code', length: 10 })
  phoneCountryCode: string;

  @Column({ name: 'phone_number', length: 20 })
  phoneNumber: string;

  @Column({ name: 'house_no', length: 50 })
  houseNo: string;

  @Column({ name: 'street_no', length: 50 })
  streetNo: string;

  @Column({ name: 'sub_sector_id' })
  subSectorId: number;

  @ManyToOne(() => SubSector, { eager: true })
  @JoinColumn({ name: 'sub_sector_id' })
  subSector: SubSector;

  @Column({ name: 'id_card_photo', type: 'text', nullable: true })
  idCardPhoto: string | null;

  @Column({ name: 'id_card_front', type: 'varchar', length: 255, nullable: true })
  idCardFront: string | null;

  @Column({ name: 'id_card_back', type: 'varchar', length: 255, nullable: true })
  idCardBack: string | null;

  /** Profile photo path (e.g. profiles/uuid.jpg), served under /profiles */
  @Column({ name: 'profile_image', type: 'varchar', length: 255, nullable: true })
  profileImage: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  approvalStatus: ApprovalStatus;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Request, (request) => request.user)
  requests: Request[];
}
