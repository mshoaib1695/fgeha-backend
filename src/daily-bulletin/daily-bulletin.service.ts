import {
  Injectable,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { DailyBulletin, BulletinFileType } from './entities/daily-bulletin.entity';
import { CreateDailyBulletinDto } from './dto/create-daily-bulletin.dto';

const ALLOWED_MIMES: Record<string, BulletinFileType> = {
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'text/plain': 'csv',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
};

@Injectable()
export class DailyBulletinService implements OnModuleInit {
  private readonly dailyFilesDir: string;

  constructor(
    @InjectRepository(DailyBulletin)
    private readonly repo: Repository<DailyBulletin>,
  ) {
    this.dailyFilesDir = path.join(process.cwd(), 'daily-files');
  }

  async onModuleInit() {
    if (!fs.existsSync(this.dailyFilesDir)) {
      fs.mkdirSync(this.dailyFilesDir, { recursive: true });
    }
  }

  /** Get bulletin for a specific date (YYYY-MM-DD). */
  async findByDate(date: string): Promise<DailyBulletin | null> {
    return this.repo.findOne({ where: { date } });
  }

  /** Get bulletin for today (for mobile app). */
  async findToday(): Promise<DailyBulletin | null> {
    const today = new Date().toISOString().slice(0, 10);
    return this.findByDate(today);
  }

  /** List all bulletins (admin), newest first. */
  async findAll(): Promise<DailyBulletin[]> {
    return this.repo.find({
      order: { date: 'DESC' },
    });
  }

  /**
   * Create or update bulletin for the given date. File is saved to daily-files.
   * Returns the bulletin with fileUrl set for response (caller adds base URL).
   */
  async upsert(
    dto: CreateDailyBulletinDto,
    file: { buffer: Buffer; mimetype: string },
  ): Promise<DailyBulletin> {
    const fileType = ALLOWED_MIMES[file.mimetype];
    if (!fileType) {
      throw new BadRequestException(
        'File must be PDF, CSV, or Excel. Received: ' + file.mimetype,
      );
    }
    const ext =
      fileType === 'pdf'
        ? 'pdf'
        : fileType === 'csv'
          ? 'csv'
          : file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ? 'xlsx'
            : 'xls';
    const dateStr = dto.date.slice(0, 10);
    const filename = `${dateStr}-${randomUUID()}.${ext}`;
    const filePath = path.join(this.dailyFilesDir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const relativePath = `daily-files/${filename}`;

    let bulletin = await this.repo.findOne({ where: { date: dateStr } });
    if (bulletin) {
      const oldPath = path.join(process.cwd(), bulletin.filePath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      bulletin.title = dto.title;
      bulletin.description = dto.description ?? null;
      bulletin.filePath = relativePath;
      bulletin.fileType = fileType;
      return this.repo.save(bulletin);
    }

    bulletin = this.repo.create({
      date: dateStr,
      title: dto.title,
      description: dto.description ?? null,
      filePath: relativePath,
      fileType,
    });
    return this.repo.save(bulletin);
  }

  /** Delete bulletin by date (admin). */
  async removeByDate(date: string): Promise<void> {
    const bulletin = await this.repo.findOne({ where: { date } });
    if (!bulletin) return;
    const fullPath = path.join(process.cwd(), bulletin.filePath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    await this.repo.remove(bulletin);
  }
}
