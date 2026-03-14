import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { News } from './entities/news.entity';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { UserRole, User } from '../users/entities/user.entity';

const IMAGE_DIR = 'news-images';
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

@Injectable()
export class NewsService implements OnModuleInit {
  constructor(
    @InjectRepository(News)
    private readonly repo: Repository<News>,
  ) {}

  async onModuleInit() {
    const dir = join(process.cwd(), IMAGE_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  /** Public / app: list all news, ordered by displayOrder then createdAt desc. */
  async findAll(): Promise<News[]> {
    return this.repo.find({
      order: { displayOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  /** Public / app: get one news by id. */
  async findOne(id: number): Promise<News | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Admin: upload image for news; returns path to use as imageUrl. */
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

  /** Admin: create news. */
  async create(dto: CreateNewsDto, user: User): Promise<News> {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const imageUrl = dto.imageUrl?.trim();
    if (!imageUrl) throw new BadRequestException('Image is required');
    const news = this.repo.create({
      title: dto.title?.trim() || null,
      content: dto.content?.trim() || null,
      imageUrl,
      displayOrder: dto.displayOrder ?? 0,
      openDetail: dto.openDetail !== false,
    });
    return this.repo.save(news);
  }

  /** Admin: update news. */
  async update(id: number, dto: UpdateNewsDto, user: User): Promise<News> {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const news = await this.repo.findOne({ where: { id } });
    if (!news) throw new NotFoundException('News not found');
    if (dto.title !== undefined) news.title = dto.title?.trim() || null;
    if (dto.content !== undefined) news.content = dto.content?.trim() || null;
    if (dto.imageUrl !== undefined) {
      const v = dto.imageUrl?.trim();
      if (!v) throw new BadRequestException('Image is required');
      news.imageUrl = v;
    }
    if (dto.displayOrder != null) news.displayOrder = dto.displayOrder;
    if (dto.openDetail !== undefined) news.openDetail = dto.openDetail;
    return this.repo.save(news);
  }

  /** Admin: delete news. */
  async remove(id: number, user: User): Promise<void> {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const news = await this.repo.findOne({ where: { id } });
    if (!news) throw new NotFoundException('News not found');
    if (news.imageUrl) {
      const fullPath = join(process.cwd(), news.imageUrl.replace(/^\//, ''));
      if (existsSync(fullPath)) unlinkSync(fullPath);
    }
    await this.repo.remove(news);
  }
}
