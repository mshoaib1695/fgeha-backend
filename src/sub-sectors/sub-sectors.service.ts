import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubSector } from '../users/entities/sub-sector.entity';
import { User } from '../users/entities/user.entity';
import { Request } from '../requests/entities/request.entity';
import { CreateSubSectorDto } from './dto/create-sub-sector.dto';
import { UpdateSubSectorDto } from './dto/update-sub-sector.dto';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class SubSectorsService {
  constructor(
    @InjectRepository(SubSector)
    private readonly repo: Repository<SubSector>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
  ) {}

  async findAll(): Promise<SubSector[]> {
    return this.repo.find({
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  }

  async findOne(id: number, user: User): Promise<SubSector> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Sub-sector not found');
    return entity;
  }

  async create(dto: CreateSubSectorDto, user: User): Promise<SubSector> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const existing = await this.repo.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Code already exists');
    const entity = this.repo.create({
      ...dto,
      displayOrder: dto.displayOrder ?? 0,
    });
    return this.repo.save(entity);
  }

  async update(
    id: number,
    dto: UpdateSubSectorDto,
    user: User,
  ): Promise<SubSector> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Sub-sector not found');
    if (dto.code != null) {
      const existing = await this.repo.findOne({ where: { code: dto.code } });
      if (existing && existing.id !== id)
        throw new ConflictException('Code already exists');
    }
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: number, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Sub-sector not found');
    const [userCount, requestCount] = await Promise.all([
      this.userRepo.count({ where: { subSectorId: id } }),
      this.requestRepo.count({ where: { subSectorId: id } }),
    ]);
    if (userCount > 0 || requestCount > 0)
      throw new ConflictException(
        'Cannot delete: sub-sector is in use by users or requests',
      );
    await this.repo.remove(entity);
  }
}
