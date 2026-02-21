import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { User, UserRole, ApprovalStatus, AccountStatus } from './entities/user.entity';
import { SubSector } from './entities/sub-sector.entity';
import { Request } from '../requests/entities/request.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SubSector)
    private readonly subSectorRepo: Repository<SubSector>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    private readonly config: ConfigService,
  ) {}

  /** Directory for uploaded ID card images (created at runtime if needed). */
  private get idcardsDir(): string {
    return path.join(process.cwd(), 'idcards');
  }

  /** Directory for profile images (created at runtime if needed). */
  private get profilesDir(): string {
    return path.join(process.cwd(), 'profiles');
  }

  async onModuleInit() {
    await this.seedSubSectorsIfEmpty();
    await this.seedAdminIfMissing();
    if (!fs.existsSync(this.idcardsDir)) {
      fs.mkdirSync(this.idcardsDir, { recursive: true });
    }
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
    }
  }

  /**
   * Save a base64 data URL (e.g. data:image/jpeg;base64,...) to idcards folder.
   * Returns relative path like "idcards/uuid-front.jpg".
   */
  private saveIdCardImage(dataUrl: string, suffix: string): string {
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) throw new ConflictException('Invalid image data URL');
    const ext = match[1] === 'jpeg' || match[1] === 'jpg' ? 'jpg' : match[1];
    const base64 = match[2];
    const buf = Buffer.from(base64, 'base64');
    const filename = `${randomUUID()}-${suffix}.${ext}`;
    const filePath = path.join(this.idcardsDir, filename);
    fs.writeFileSync(filePath, buf);
    return `idcards/${filename}`;
  }

  /**
   * Save a base64 data URL to profiles folder. Returns relative path like "profiles/uuid.jpg".
   */
  private saveProfileImage(dataUrl: string): string {
    const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) throw new ConflictException('Invalid image data URL');
    const ext = match[1] === 'jpeg' || match[1] === 'jpg' ? 'jpg' : match[1];
    const base64 = match[2];
    const buf = Buffer.from(base64, 'base64');
    const filename = `${randomUUID()}.${ext}`;
    const filePath = path.join(this.profilesDir, filename);
    fs.writeFileSync(filePath, buf);
    return `profiles/${filename}`;
  }

  /** Create default admin if no admin user exists (email/password from env or defaults). */
  private async seedAdminIfMissing() {
    const existingAdmin = await this.userRepo.findOne({
      where: { role: UserRole.ADMIN },
    });
    if (existingAdmin) return;

    const email = this.config.get('ADMIN_EMAIL', 'admin@example.com');
    const password = this.config.get('ADMIN_PASSWORD', 'Admin123!');
    const subSector = await this.subSectorRepo.findOne({ where: {} });
    if (!subSector) return;

    const hashed = await bcrypt.hash(password, 10);
    const admin = this.userRepo.create({
      email,
      password: hashed,
      fullName: 'Admin',
      phoneCountryCode: '+1',
      phoneNumber: '0000000000',
      houseNo: '-',
      streetNo: '-',
      subSectorId: subSector.id,
      role: UserRole.ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
      accountStatus: AccountStatus.ACTIVE,
    });
    await this.userRepo.save(admin);
  }

  private async seedSubSectorsIfEmpty() {
    const count = await this.subSectorRepo.count();
    if (count > 0) return;
    const defaultSectors = 'ABCDEFGHIJ'.split('').map((code, i) =>
      this.subSectorRepo.create({
        name: `Sector ${code}`,
        code,
        displayOrder: i + 1,
      }),
    );
    await this.subSectorRepo.save(defaultSectors);
  }

  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const existing = await this.userRepo.findOne({
      where: { email: createUserDto.email },
    });
    if (existing) throw new ConflictException('Email already registered');
    const subSector = await this.subSectorRepo.findOne({
      where: { id: createUserDto.subSectorId },
    });
    if (!subSector)
      throw new ConflictException('Invalid sub sector');
    const hashed = await bcrypt.hash(createUserDto.password, 10);

    let idCardFrontPath: string | null = null;
    let idCardBackPath: string | null = null;
    if (createUserDto.idCardFront?.trim()) {
      idCardFrontPath = this.saveIdCardImage(createUserDto.idCardFront.trim(), 'front');
    }
    if (createUserDto.idCardBack?.trim()) {
      idCardBackPath = this.saveIdCardImage(createUserDto.idCardBack.trim(), 'back');
    }

    const { idCardFront, idCardBack, ...dtoWithoutCards } = createUserDto;
    const user = this.userRepo.create({
      ...dtoWithoutCards,
      password: hashed,
      role: UserRole.USER,
      approvalStatus: ApprovalStatus.APPROVED,
      accountStatus: AccountStatus.ACTIVE,
      idCardFront: idCardFrontPath,
      idCardBack: idCardBackPath,
    });
    const saved = await this.userRepo.save(user);
    const { password: _, ...rest } = saved;
    return rest;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: number): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['subSector'],
    });
    if (!user) return null;
    const { password: _, ...rest } = user;
    return rest;
  }

  async getSubSectors(): Promise<{ id: number; name: string; code: string }[]> {
    return this.subSectorRepo.find({
      order: { displayOrder: 'ASC' },
      select: ['id', 'name', 'code'],
    });
  }

  async validatePassword(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  async findAll(user: User): Promise<User[]> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    return this.userRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['subSector'],
    });
  }

  async findPending(user: User): Promise<User[]> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    return this.userRepo.find({
      where: { approvalStatus: ApprovalStatus.PENDING },
      order: { createdAt: 'DESC' },
      relations: ['subSector'],
    });
  }

  async findOne(id: number, currentUser: User): Promise<User> {
    const u = await this.userRepo.findOne({
      where: { id },
      relations: ['subSector'],
    });
    if (!u) throw new NotFoundException('User not found');
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id)
      throw new ForbiddenException('Cannot view other user');
    return u as User;
  }

  /** Current user can update their own profile (name, phone, address, profile image). No role/approvalStatus. */
  async updateMe(
    currentUser: User,
    dto: UpdateMeDto,
  ): Promise<Omit<User, 'password'>> {
    const user = await this.userRepo.findOne({ where: { id: currentUser.id } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.phoneCountryCode !== undefined) user.phoneCountryCode = dto.phoneCountryCode;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;
    if (dto.houseNo !== undefined) user.houseNo = dto.houseNo;
    if (dto.streetNo !== undefined) user.streetNo = dto.streetNo;
    if (dto.subSectorId !== undefined) {
      const sub = await this.subSectorRepo.findOne({ where: { id: dto.subSectorId } });
      if (!sub) throw new ConflictException('Invalid sub sector');
      user.subSectorId = dto.subSectorId;
    }
    if (dto.profileImage !== undefined && dto.profileImage.trim()) {
      user.profileImage = this.saveProfileImage(dto.profileImage.trim());
    }
    const saved = await this.userRepo.save(user);
    const { password: _, ...rest } = saved;
    return rest;
  }

  async deactivateMe(currentUser: User): Promise<Omit<User, 'password'>> {
    const user = await this.userRepo.findOne({ where: { id: currentUser.id } });
    if (!user) throw new NotFoundException('User not found');
    user.accountStatus = AccountStatus.DEACTIVATED;
    const saved = await this.userRepo.save(user);
    const { password: _, ...rest } = saved;
    return rest;
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    currentUser: User,
  ): Promise<Omit<User, 'password'>> {
    if (currentUser.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (updateUserDto.approvalStatus !== undefined)
      user.approvalStatus = updateUserDto.approvalStatus;
    if (updateUserDto.accountStatus !== undefined)
      user.accountStatus = updateUserDto.accountStatus;
    if (updateUserDto.fullName !== undefined) user.fullName = updateUserDto.fullName;
    if (updateUserDto.email !== undefined) user.email = updateUserDto.email;
    if (updateUserDto.password !== undefined)
      user.password = await bcrypt.hash(updateUserDto.password, 10);
    if (updateUserDto.phoneCountryCode !== undefined)
      user.phoneCountryCode = updateUserDto.phoneCountryCode;
    if (updateUserDto.phoneNumber !== undefined)
      user.phoneNumber = updateUserDto.phoneNumber;
    if (updateUserDto.houseNo !== undefined) user.houseNo = updateUserDto.houseNo;
    if (updateUserDto.streetNo !== undefined) user.streetNo = updateUserDto.streetNo;
    if (updateUserDto.subSectorId !== undefined) {
      const sub = await this.subSectorRepo.findOne({
        where: { id: updateUserDto.subSectorId },
      });
      if (!sub) throw new ConflictException('Invalid sub sector');
      user.subSectorId = updateUserDto.subSectorId;
    }
    if (updateUserDto.idCardPhoto !== undefined)
      user.idCardPhoto = updateUserDto.idCardPhoto;
    const saved = await this.userRepo.save(user);
    const { password: _, ...rest } = saved;
    return rest;
  }

  async approve(id: number, currentUser: User): Promise<Omit<User, 'password'>> {
    return this.update(
      id,
      { approvalStatus: ApprovalStatus.APPROVED },
      currentUser,
    );
  }

  async reject(id: number, currentUser: User): Promise<Omit<User, 'password'>> {
    return this.update(
      id,
      { approvalStatus: ApprovalStatus.REJECTED },
      currentUser,
    );
  }

  async remove(id: number, currentUser: User): Promise<void> {
    if (currentUser.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const result = await this.userRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('User not found');
  }

  /** Admin: users with their request count (for "see user has given request") */
  async findUsersWithRequestCount(
    currentUser: User,
  ): Promise<{ id: number; email: string; fullName: string; requestCount: number }[]> {
    if (currentUser.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const users = await this.userRepo.find({
      where: { approvalStatus: ApprovalStatus.APPROVED },
      order: { createdAt: 'DESC' },
      select: ['id', 'email', 'fullName'],
    });
    const result = await Promise.all(
      users.map(async (u) => {
        const count = await this.requestRepo.count({ where: { userId: u.id } });
        return { id: u.id, email: u.email, fullName: u.fullName, requestCount: count };
      }),
    );
    return result;
  }
}
