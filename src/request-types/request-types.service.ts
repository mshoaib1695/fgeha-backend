import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestTypeEntity } from './entities/request-type.entity';
import { CreateRequestTypeDto } from './dto/create-request-type.dto';
import { UpdateRequestTypeDto } from './dto/update-request-type.dto';
import { User, UserRole } from '../users/entities/user.entity';

const DEFAULT_TYPES: { name: string; slug: string; displayOrder: number }[] = [
  { name: 'Water', slug: 'water', displayOrder: 1 },
  { name: 'Garbage', slug: 'garbage', displayOrder: 2 },
  { name: 'Street light', slug: 'street_light', displayOrder: 3 },
  { name: 'Road repair', slug: 'road_repair', displayOrder: 4 },
  { name: 'Drainage', slug: 'drainage', displayOrder: 5 },
  { name: 'Other', slug: 'other', displayOrder: 6 },
];

@Injectable()
export class RequestTypesService implements OnModuleInit {
  constructor(
    @InjectRepository(RequestTypeEntity)
    private readonly repo: Repository<RequestTypeEntity>,
  ) {}

  async onModuleInit() {
    const count = await this.repo.count();
    if (count > 0) return;
    for (const t of DEFAULT_TYPES) {
      await this.repo.save(this.repo.create(t));
    }
  }

  /** Public: list all request types (for app dropdown when creating request) */
  async findAll(): Promise<RequestTypeEntity[]> {
    return this.repo.find({
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  }

  /** Admin: create request type */
  async create(dto: CreateRequestTypeDto, user: User): Promise<RequestTypeEntity> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const existing = await this.repo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    const entity = this.repo.create({
      ...dto,
      displayOrder: dto.displayOrder ?? 0,
    });
    return this.repo.save(entity);
  }

  /** Admin: get one */
  async findOne(id: number, user: User): Promise<RequestTypeEntity> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Request type not found');
    return entity;
  }

  /** Admin: update */
  async update(
    id: number,
    dto: UpdateRequestTypeDto,
    user: User,
  ): Promise<RequestTypeEntity> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Request type not found');
    if (dto.slug != null) {
      const existing = await this.repo.findOne({ where: { slug: dto.slug } });
      if (existing && existing.id !== id) throw new ConflictException('Slug already exists');
    }
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  /** Admin: delete */
  async remove(id: number, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Request type not found');
    await this.repo.remove(entity);
  }
}
