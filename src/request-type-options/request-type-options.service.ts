import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
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

function deriveDefaultOptionPrefix(label: string): string {
  const seed = (label || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return seed.slice(0, 6) || 'SRV';
}

function deriveOptionSlug(slugRaw: string | null | undefined, label: string): string {
  const source = (slugRaw ?? '').trim() || label;
  const normalized = source
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'service_option';
}

@Injectable()
export class RequestTypeOptionsService {
  constructor(
    @InjectRepository(RequestTypeOptionEntity)
    private readonly repo: Repository<RequestTypeOptionEntity>,
  ) {}

  private normalizeConfig(
    optionType: RequestTypeOptionEntity['optionType'],
    config: Record<string, unknown> | RequestTypeOptionEntity['config'] | null | undefined,
  ): RequestTypeOptionEntity['config'] {
    if (!config || typeof config !== 'object') return null;
    const cfg = config as Record<string, unknown>;
    if (optionType === 'form') {
      const issueImage = cfg.issueImage;
      return {
        issueImage:
          issueImage === 'none' || issueImage === 'optional' || issueImage === 'required'
            ? issueImage
            : 'optional',
      };
    }
    if (optionType === 'list') {
      return { listKey: typeof cfg.listKey === 'string' ? cfg.listKey : undefined };
    }
    if (optionType === 'rules') {
      const rawRules = Array.isArray(cfg.rules) ? cfg.rules : [];
      const rules = rawRules
        .map((r) =>
          r && typeof r === 'object'
            ? { description: String((r as { description?: unknown }).description ?? '').trim() }
            : null,
        )
        .filter((r): r is { description: string } => !!r && !!r.description);
      return {
        content: typeof cfg.content === 'string' ? cfg.content : undefined,
        rules,
      };
    }
    if (optionType === 'notification') {
      return { content: typeof cfg.content === 'string' ? cfg.content : undefined };
    }
    if (optionType === 'link') {
      return { url: typeof cfg.url === 'string' ? cfg.url : undefined };
    }
    if (optionType === 'phone') {
      return {
        phoneNumber:
          typeof cfg.phoneNumber === 'string' ? cfg.phoneNumber.trim() : undefined,
      };
    }
    return null;
  }

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
    const prefix = dto.requestNumberPrefix?.trim().toUpperCase() || deriveDefaultOptionPrefix(dto.label);
    const option = this.repo.create({
      requestTypeId: dto.requestTypeId,
      label: dto.label,
      slug: deriveOptionSlug(dto.slug, dto.label),
      optionType: dto.optionType,
      config: this.normalizeConfig(dto.optionType, dto.config ?? null),
      displayOrder: dto.displayOrder ?? 0,
      imageUrl: dto.imageUrl ?? null,
      headerIcon: dto.headerIcon ?? null,
      requestNumberPrefix: prefix,
      requestNumberPadding: 4,
      requestNumberNext: 1,
    });
    return this.repo.save(option);
  }

  /** Admin: update option. */
  async update(id: number, dto: UpdateRequestTypeOptionDto, user: User): Promise<RequestTypeOptionEntity> {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const option = await this.repo.findOne({ where: { id } });
    if (!option) throw new NotFoundException('Option not found');
    const previousLabel = option.label;
    if (dto.label != null) option.label = dto.label;
    if (dto.slug !== undefined) {
      option.slug = deriveOptionSlug(dto.slug, option.label);
    } else if (dto.label != null && (!option.slug || !option.slug.trim())) {
      option.slug = deriveOptionSlug(null, option.label);
    } else if (dto.label != null && previousLabel !== option.label && option.slug === deriveOptionSlug(null, previousLabel)) {
      // Keep auto-generated slugs in sync when label changes.
      option.slug = deriveOptionSlug(null, option.label);
    }
    if (dto.optionType != null) option.optionType = dto.optionType;
    if (dto.config !== undefined) {
      option.config = this.normalizeConfig(dto.optionType ?? option.optionType, dto.config);
    }
    if (dto.displayOrder != null) option.displayOrder = dto.displayOrder;
    if (dto.imageUrl !== undefined) option.imageUrl = dto.imageUrl;
    if (dto.headerIcon !== undefined) option.headerIcon = dto.headerIcon;
    if (dto.requestNumberPrefix !== undefined) {
      const normalized = dto.requestNumberPrefix?.trim().toUpperCase() ?? '';
      option.requestNumberPrefix = normalized || deriveDefaultOptionPrefix(option.label);
    }
    if (!option.requestNumberPrefix?.trim()) {
      option.requestNumberPrefix = deriveDefaultOptionPrefix(option.label);
    }
    if (!option.requestNumberPadding || option.requestNumberPadding < 1) {
      option.requestNumberPadding = 4;
    }
    if (!option.requestNumberNext || option.requestNumberNext < 1) {
      option.requestNumberNext = 1;
    }
    return this.repo.save(option);
  }

  /** Admin: delete option. */
  async remove(id: number, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const option = await this.repo.findOne({ where: { id } });
    if (!option) throw new NotFoundException('Option not found');
    try {
      // Legacy compatibility: some deployments may still have requests.request_type_option_id FK.
      // If present, detach rows first so deleting service options works consistently.
      const columnCheck = (await this.repo.query(
        `SELECT COUNT(*) AS cnt
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'requests'
           AND COLUMN_NAME = 'request_type_option_id'`,
      )) as Array<{ cnt?: number | string }>;
      const hasLegacyRefColumn = Number(columnCheck?.[0]?.cnt ?? 0) > 0;

      if (hasLegacyRefColumn) {
        await this.repo.query(
          'UPDATE requests SET request_type_option_id = NULL WHERE request_type_option_id = ?',
          [id],
        );
      }

      await this.repo.delete(id);
    } catch (e) {
      const err = e as { code?: string; errno?: number; message?: string };
      if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
        throw new ConflictException('This option is in use and cannot be deleted yet.');
      }
      throw e;
    }
  }
}
