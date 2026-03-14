import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from './entities/app-settings.entity';
import { UserRole, User } from '../users/entities/user.entity';

export const NEWS_SECTION_TITLE_KEY = 'news_section_title';
export const NEWS_DETAIL_HEADER_KEY = 'news_detail_header';
export const SHOW_NEWS_SECTION_HEADING_KEY = 'show_news_section_heading';
export const SHOW_NEWS_CAROUSEL_OVERLAY_KEY = 'show_news_carousel_overlay';
export const RATING_ENABLED_KEY = 'rating_enabled';
const DEFAULT_NEWS_SECTION_TITLE = 'Latest News';

@Injectable()
export class AppSettingsService {
  constructor(
    @InjectRepository(AppSettings)
    private readonly repo: Repository<AppSettings>,
  ) {}

  /** Public: get settings for app (news section title, detail header, rating, etc.). */
  async getForApp(): Promise<{
    newsSectionTitle: string;
    newsDetailHeader: string;
    showNewsSectionHeading: boolean;
    showNewsCarouselOverlay: boolean;
    ratingEnabled: boolean;
  }> {
    const [sectionRow, detailRow, headingRow, overlayRow, ratingRow] = await Promise.all([
      this.repo.findOne({ where: { key: NEWS_SECTION_TITLE_KEY } }),
      this.repo.findOne({ where: { key: NEWS_DETAIL_HEADER_KEY } }),
      this.repo.findOne({ where: { key: SHOW_NEWS_SECTION_HEADING_KEY } }),
      this.repo.findOne({ where: { key: SHOW_NEWS_CAROUSEL_OVERLAY_KEY } }),
      this.repo.findOne({ where: { key: RATING_ENABLED_KEY } }),
    ]);
    const headingVal = headingRow?.value?.trim()?.toLowerCase();
    const overlayVal = overlayRow?.value?.trim()?.toLowerCase();
    const ratingVal = ratingRow?.value?.trim()?.toLowerCase();
    return {
      newsSectionTitle: sectionRow?.value?.trim() || DEFAULT_NEWS_SECTION_TITLE,
      newsDetailHeader: detailRow?.value?.trim() ?? '',
      showNewsSectionHeading: headingVal !== 'false' && headingVal !== '0',
      showNewsCarouselOverlay: overlayVal !== 'false' && overlayVal !== '0',
      ratingEnabled: ratingVal !== 'false' && ratingVal !== '0',
    };
  }

  /** Admin: get all settings. */
  async getAll(): Promise<Record<string, string>> {
    const rows = await this.repo.find();
    const out: Record<string, string> = {};
    for (const r of rows) {
      out[r.key] = r.value ?? '';
    }
    return out;
  }

  /** Admin: update settings. */
  async update(
    updates: {
      newsSectionTitle?: string;
      newsDetailHeader?: string;
      showNewsSectionHeading?: boolean;
      showNewsCarouselOverlay?: boolean;
      ratingEnabled?: boolean;
    },
    user: User,
  ): Promise<{ newsSectionTitle: string; newsDetailHeader: string; showNewsSectionHeading: boolean; showNewsCarouselOverlay: boolean; ratingEnabled: boolean }> {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');

    if (updates.newsSectionTitle !== undefined && updates.newsSectionTitle !== null) {
      let row = await this.repo.findOne({ where: { key: NEWS_SECTION_TITLE_KEY } });
      const val = String(updates.newsSectionTitle ?? '').trim() || DEFAULT_NEWS_SECTION_TITLE;
      if (!row) {
        row = this.repo.create({
          key: NEWS_SECTION_TITLE_KEY,
          value: val,
        });
      } else {
        row.value = val;
      }
      await this.repo.save(row);
    }

    if (updates.newsDetailHeader !== undefined) {
      let row = await this.repo.findOne({ where: { key: NEWS_DETAIL_HEADER_KEY } });
      const val = String(updates.newsDetailHeader ?? '').trim();
      if (!row) {
        row = this.repo.create({
          key: NEWS_DETAIL_HEADER_KEY,
          value: val,
        });
      } else {
        row.value = val;
      }
      await this.repo.save(row);
    }

    if (updates.showNewsSectionHeading !== undefined) {
      let row = await this.repo.findOne({ where: { key: SHOW_NEWS_SECTION_HEADING_KEY } });
      const val = updates.showNewsSectionHeading ? 'true' : 'false';
      if (!row) {
        row = this.repo.create({
          key: SHOW_NEWS_SECTION_HEADING_KEY,
          value: val,
        });
      } else {
        row.value = val;
      }
      await this.repo.save(row);
    }

    if (updates.showNewsCarouselOverlay !== undefined) {
      let row = await this.repo.findOne({ where: { key: SHOW_NEWS_CAROUSEL_OVERLAY_KEY } });
      const val = updates.showNewsCarouselOverlay ? 'true' : 'false';
      if (!row) {
        row = this.repo.create({
          key: SHOW_NEWS_CAROUSEL_OVERLAY_KEY,
          value: val,
        });
      } else {
        row.value = val;
      }
      await this.repo.save(row);
    }

    if (updates.ratingEnabled !== undefined) {
      let row = await this.repo.findOne({ where: { key: RATING_ENABLED_KEY } });
      const val = updates.ratingEnabled === true ? 'true' : 'false';
      if (!row) {
        row = this.repo.create({
          key: RATING_ENABLED_KEY,
          value: val,
        });
      } else {
        row.value = val;
      }
      await this.repo.save(row);
    }

    return this.getForApp();
  }
}
