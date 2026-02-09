import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { RequestTypeOptionEntity } from './entities/request-type-option.entity';
import { CreateRequestTypeOptionDto } from './dto/create-request-type-option.dto';
import { UpdateRequestTypeOptionDto } from './dto/update-request-type-option.dto';
import { UserRole, User } from '../users/entities/user.entity';

const IMAGE_DIR = 'request-type-option-images';
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

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

  /** Admin: upload image for option; returns path to use as imageUrl. */
  async uploadImage(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    user: User,
  ): Promise<{ url: string }> {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    if (buffer.length > MAX_IMAGE_SIZE) throw new BadRequestException('Image too large (max 2MB)');
    if (!ALLOWED_MIMES.includes(mimetype)) throw new BadRequestException('Allowed: PNG, JPEG, WebP, GIF');
    const dir = join(process.cwd(), IMAGE_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const ext = originalName.split('.').pop()?.toLowerCase() || 'png';
    const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
    const filepath = join(dir, filename);
    writeFileSync(filepath, buffer);
    return { url: `/${IMAGE_DIR}/${filename}` };
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
      imageUrl: dto.imageUrl ?? null,
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
    if (dto.imageUrl !== undefined) option.imageUrl = dto.imageUrl;
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
