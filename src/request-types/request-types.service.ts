import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { RequestTypeEntity } from './entities/request-type.entity';
import { CreateRequestTypeDto } from './dto/create-request-type.dto';
import { UpdateRequestTypeDto } from './dto/update-request-type.dto';
import { User, UserRole } from '../users/entities/user.entity';

const ICON_DIR = 'request-type-icons';
const MAX_ICON_SIZE = 1024 * 1024; // 1024KB
const ALLOWED_MIMES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const DEFAULT_TYPES: { name: string; slug: string; displayOrder: number }[] = [
  { name: 'Water', slug: 'water', displayOrder: 1 },
  { name: 'Garbage', slug: 'garbage', displayOrder: 2 },
  { name: 'Street light', slug: 'street_light', displayOrder: 3 },
  { name: 'Road repair', slug: 'road_repair', displayOrder: 4 },
  { name: 'Drainage', slug: 'drainage', displayOrder: 5 },
  { name: 'Other', slug: 'other', displayOrder: 6 },
];

function deriveDefaultPrefix(name?: string, slug?: string): string {
  const source = (name || slug || 'REQ').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return source.slice(0, 3) || 'REQ';
}

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

  /** Admin: upload icon for request type; returns path to use as iconUrl (e.g. /request-type-icons/xxx.png). */
  async uploadIcon(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    user: User,
  ): Promise<{ url: string }> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    if (buffer.length > MAX_ICON_SIZE)
      throw new BadRequestException('Icon file too large (max 1024KB)');
    if (!ALLOWED_MIMES.includes(mimetype))
      throw new BadRequestException('Allowed: SVG, PNG, JPEG, WebP, GIF');
    const dir = join(process.cwd(), ICON_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const ext = originalName.split('.').pop()?.toLowerCase() || (mimetype.includes('svg') ? 'svg' : 'png');
    const safeExt = ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
    const filepath = join(dir, filename);
    writeFileSync(filepath, buffer);
    return { url: `/${ICON_DIR}/${filename}` };
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
      requestNumberPrefix: deriveDefaultPrefix(dto.name, dto.slug),
      requestNumberPadding: 4,
      requestNumberNext: 1,
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
    if (dto.requestNumberPrefix != null) {
      dto.requestNumberPrefix = dto.requestNumberPrefix.trim().toUpperCase();
      if (!dto.requestNumberPrefix) {
        dto.requestNumberPrefix = null;
      }
    }
    Object.assign(entity, dto);
    // Numbering config is backend-managed only.
    if (!entity.requestNumberPrefix?.trim()) {
      entity.requestNumberPrefix = deriveDefaultPrefix(entity.name, entity.slug);
    }
    if (!entity.requestNumberPadding || entity.requestNumberPadding < 1) {
      entity.requestNumberPadding = 4;
    }
    if (!entity.requestNumberNext || entity.requestNumberNext < 1) {
      entity.requestNumberNext = 1;
    }
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
