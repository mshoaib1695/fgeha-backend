import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequestTypeOptionEntity } from './entities/request-type-option.entity';
import { CreateRequestTypeOptionDto } from './dto/create-request-type-option.dto';
import { UpdateRequestTypeOptionDto } from './dto/update-request-type-option.dto';
import { UserRole, User } from '../users/entities/user.entity';

@Injectable()
export class RequestTypeOptionsService {
  constructor(
    @InjectRepository(RequestTypeOptionEntity)
    private readonly repo: Repository<RequestTypeOptionEntity>,
  ) {}

  /** Public / app: get options for a request type, ordered by displayOrder. */
  async findByRequestType(requestTypeId: number): Promise<RequestTypeOptionEntity[]> {
    return this.repo.find({
      where: { requestTypeId },
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
  }

  /** Public / app: get one option by id (e.g. for rules content). */
  async findOne(id: number): Promise<RequestTypeOptionEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Admin: list options (optionally filter by requestTypeId). */
  async findAll(requestTypeId?: number): Promise<RequestTypeOptionEntity[]> {
    if (requestTypeId != null) {
      return this.repo.find({
        where: { requestTypeId },
        order: { displayOrder: 'ASC', id: 'ASC' },
      });
    }
    return this.repo.find({ order: { requestTypeId: 'ASC', displayOrder: 'ASC', id: 'ASC' } });
  }

  /** Admin: create option. */
  async create(dto: CreateRequestTypeOptionDto, user: User): Promise<RequestTypeOptionEntity> {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const option = this.repo.create({
      requestTypeId: dto.requestTypeId,
      label: dto.label,
      optionType: dto.optionType,
      config: dto.config ?? null,
      displayOrder: dto.displayOrder ?? 0,
    });
    return this.repo.save(option);
  }

  /** Admin: update option. */
  async update(id: number, dto: UpdateRequestTypeOptionDto, user: User): Promise<RequestTypeOptionEntity> {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const option = await this.repo.findOne({ where: { id } });
    if (!option) throw new NotFoundException('Option not found');
    if (dto.label != null) option.label = dto.label;
    if (dto.optionType != null) option.optionType = dto.optionType;
    if (dto.config !== undefined) option.config = dto.config;
    if (dto.displayOrder != null) option.displayOrder = dto.displayOrder;
    return this.repo.save(option);
  }

  /** Admin: delete option. */
  async remove(id: number, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const option = await this.repo.findOne({ where: { id } });
    if (!option) throw new NotFoundException('Option not found');
    await this.repo.remove(option);
  }
}
